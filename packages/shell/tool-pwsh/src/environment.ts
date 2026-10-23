/** Bounded environment inspection through the calling tool's existing shell policy. */
import type { ShellRunResult } from '@deepseek-ai/dsh-shell'

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`
const PYTHON_PROBE = 'import sys,json; print(json.dumps(dict(executable=sys.executable,version=list(sys.version_info[:3]))))'

/**
 * Build a metadata-only discovery command; interpreter health is checked separately.
 * @param python - explicit interpreter candidate, otherwise project and PATH candidates.
 * @returns PowerShell text producing a bounded JSON object through normal output capture.
 */
export function discoveryCommand(python?: string): string {
  return [
    '$candidates = @()',
    python === undefined
      ? "foreach ($relative in @('.venv/Scripts/python.exe','venv/Scripts/python.exe','.venv/bin/python','venv/bin/python')) { $p = Join-Path (Get-Location).Path $relative; if (Test-Path -LiteralPath $p -PathType Leaf) { $candidates += @{path=$p;source='project'} } }; foreach ($name in @('python','python3')) { foreach ($cmd in @(Get-Command $name -CommandType Application -All -ErrorAction SilentlyContinue)) { $candidates += @{path=$cmd.Source;source='PATH'} } }"
      : `$p = ${quote(python)}; if (-not (Split-Path -IsAbsolute $p)) { $p = Join-Path (Get-Location).Path $p }; $candidates += @{path=$p;source='explicit'}`,
    "$commands = @{}; foreach ($name in @('node','npm','uv','conda','py')) { $cmd = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1; if ($null -ne $cmd) { $commands[$name] = $cmd.Source } }",
    '@{cwd=(Get-Location).Path;shellVersion=$PSVersionTable.PSVersion.ToString();languageMode=[string]$ExecutionContext.SessionState.LanguageMode;commands=$commands;cache=@{uv=$env:UV_CACHE_DIR;pip=$env:PIP_CACHE_DIR;npm=$env:npm_config_cache};pythonCandidates=@($candidates)} | ConvertTo-Json -Depth 5 -Compress',
  ].join('; ')
}

/** One subprocess's original outcome, without unbounded or possibly sensitive diagnostics. */
function outcome(result: ShellRunResult) {
  return { exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut,
    aborted: result.aborted, truncated: result.stdout.truncated || result.stderr.truncated,
    ...result.sandbox === undefined ? {} : { sandbox: result.sandbox } }
}

/** Reject incomplete process output rather than treating malformed facts as a healthy environment. */
function parsedOutput(result: ShellRunResult): unknown {
  if (result.exitCode !== 0 || result.signal !== null || result.timedOut || result.aborted || result.stdout.truncated || result.stderr.truncated
    || result.sandbox?.denied === true || result.sandbox?.runnerFailed === true) {
    throw new Error('environment probe did not complete with intact output')
  }
  return JSON.parse(result.stdout.text) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Inspect the shell and validate candidate Python startup, without selecting or repairing an environment.
 * @param run - policy-bound shell invocation with cancellation, timeout, and output limits.
 * @param options - explicit interpreter and maximum candidates to validate.
 * @returns safe JSON facts and per-candidate startup outcomes; no dependency-health claim.
 */
export async function inspectEnvironment(
  run: (command: string) => Promise<ShellRunResult>,
  options: { python?: string; maxCandidates: number },
): Promise<Record<string, unknown>> {
  const discovery = await run(discoveryCommand(options.python))
  let facts: unknown
  try {
    facts = parsedOutput(discovery)
  } catch {
    return { status: 'unavailable', discovery: outcome(discovery), reason: 'Shell discovery failed or returned incomplete JSON; no environment was selected.' }
  }
  if (!isRecord(facts) || typeof facts.cwd !== 'string' || typeof facts.shellVersion !== 'string'
    || typeof facts.languageMode !== 'string' || !isRecord(facts.commands) || !isRecord(facts.cache)
    || !Array.isArray(facts.pythonCandidates)
    || facts.pythonCandidates.some(item => !isRecord(item) || typeof item.path !== 'string' || !['project', 'PATH', 'explicit'].includes(String(item.source)))) {
    return { status: 'unavailable', reason: 'Shell discovery returned invalid fields; no environment was selected.' }
  }
  const candidates = facts.pythonCandidates as { path: string; source: string }[]
  const unique = candidates.filter((item, i) => candidates.findIndex(other =>
    (process.platform === 'win32' ? other.path.toLowerCase() === item.path.toLowerCase() : other.path === item.path)) === i)
  const python = []
  for (const candidate of unique.slice(0, options.maxCandidates)) {
    // -I -S avoids project imports and site/.pth startup hooks; -B avoids bytecode writes.
    const result = await run(`& ${quote(candidate.path)} -I -S -B -X utf8 -c ${quote(PYTHON_PROBE)}; exit $LASTEXITCODE`)
    let health: unknown
    try {
      health = parsedOutput(result)
    } catch {
      // Exit, truncation and timeout facts suffice; do not project arbitrary startup diagnostics.
    }
    const usable = isRecord(health) && typeof health.executable === 'string'
      && Array.isArray(health.version) && health.version.length === 3 && health.version.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0)
    python.push({ candidate: candidate.path, source: candidate.source, startup: usable ? 'ok' : 'failed',
      ...usable ? { executable: (health as Record<string, unknown>).executable, version: (health as Record<string, unknown>).version } : {},
      ...outcome(result) })
  }
  return { status: 'inspected', cwd: facts.cwd, shellVersion: facts.shellVersion, languageMode: facts.languageMode,
    commands: facts.commands, cache: facts.cache, python, candidatesOmitted: Math.max(0, unique.length - options.maxCandidates),
    note: 'No interpreter was selected or installed. Startup checks use isolated Python without site packages; they do not establish dependency, pip, Conda activation, or DLL health. Reuse an explicitly chosen project interpreter and its package manager; do not silently replace a failed project environment with a global one.' }
}
