/** Opt-in real read-only checks, without network access or permission changes. */
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local'
import { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { ShellRunResult } from '@deepseek-ai/dsh-shell'
import { SandboxPwshExecutor } from '../src/index.ts'

const enabled = process.platform === 'win32' && process.env.DSH_RUN_SANDBOX_COMPAT === '1'
const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`

it.skipIf(!enabled)('preserves read-only encoding initialization and command semantics on configured PowerShell versions', async () => {
  const report = process.env.DSH_READONLY_ENCODING_REPORT
  const shells = [process.env.DSH_TEST_PWSH7, process.env.DSH_TEST_PWSH5]
  const python = process.env.DSH_TEST_PYTHON
  if (!report || !python || !existsSync(python) || shells.some(shell => !shell || !existsSync(shell))) {
    throw new Error('Set report, existing Python, and both DSH_TEST_PWSH7/DSH_TEST_PWSH5 paths')
  }
  const root = mkdtempSync(join(tmpdir(), 'readonly-encoding-'))
  const workspace = join(root, 'workspace')
  mkdirSync(workspace)
  const observations: { shell: string; id: string; result: ShellRunResult }[] = []
  let completed = false
  try {
    for (const pwshPath of shells as string[]) {
      const ctx = new Context()
      try {
        await ctx.plugin(LocalSubprocessRuntime)
        await ctx.plugin(LocalSandboxProvider)
        await ctx.plugin(SandboxPolicyService, { mode: 'read-only', workspaceRoot: workspace })
        await ctx.plugin(SandboxPwshExecutor, { pwshPath, timeoutMs: 15_000, maxOutputBytes: 12_000, graceMs: 300 })
        const shell = ctx.shell as SandboxPwshExecutor
        const run = async (id: string, command: string) => {
          const result = await shell.run(shell.resolve({ command, workdir: workspace,
            sandboxPolicy: { mode: 'read-only', workspaceRoot: workspace } }))
          observations.push({ shell: pwshPath, id, result })
          expect(result.timedOut).toBe(false)
          expect(result.aborted).toBe(false)
          expect(result.stderr.text).not.toMatch(/CannotCreateTypeConstrainedLanguage|PropertySetterNotSupportedInConstrainedLanguage|Only core types/)
          return result
        }
        const mode = await run('mode', 'Write-Output $ExecutionContext.SessionState.LanguageMode')
        expect(mode.exitCode).toBe(0)
        expect(mode.stdout.text.trim()).toBe('ConstrainedLanguage')
        expect(mode.stderr.text).toBe('')

        const native = await run('native-utf8', `& ${quote(python)} -c 'print(chr(0x4e2d)+chr(0x6587)+chr(0x1f600))'; exit $LASTEXITCODE`)
        expect(native.exitCode).toBe(0)
        expect(native.stdout.text.trim()).toBe('\u4e2d\u6587\uD83D\uDE00')
        expect(native.stderr.text).toBe('')

        const pipeline = await run('pipeline-has-no-added-bom', `${quote('\u4e2d\u6587')} | & ${quote(python)} -c 'import sys,json; print(json.dumps([ord(c) for c in sys.stdin.read().strip()]))'; exit $LASTEXITCODE`)
        expect(pipeline.exitCode).toBe(0)
        expect(pipeline.stdout.text).not.toContain('65279')
        expect(pipeline.stderr.text).toBe('')

        expect((await run('explicit-exit', 'exit 7')).exitCode).toBe(7)
        const caught = await run('handled-error', "try { throw 'caught-marker' } catch { Write-Output 'handled' }")
        expect(caught.exitCode).toBe(0)
        expect(caught.stdout.text.trim()).toBe('handled')
        expect(caught.stderr.text).toBe('')
        const nonterminating = await run('nonterminating-error', "Write-Error 'expected-marker'; Write-Output 'continued'")
        expect(nonterminating.exitCode).toBe(0)
        expect(nonterminating.stdout.text.trim()).toBe('continued')
        expect(nonterminating.stderr.text).toContain('expected-marker')
        const terminating = await run('terminating-error', "throw 'terminating-marker'")
        expect(terminating.exitCode).toBe(1)
        expect(terminating.stderr.text).toContain('terminating-marker')

        const denied = join(workspace, 'denied.txt')
        const write = await run('write-still-denied', `try { Set-Content -LiteralPath ${quote(denied)} -Value bad -ErrorAction Stop } catch { Write-Output 'denied'; exit 24 }`)
        expect(write.exitCode).toBe(24)
        expect(existsSync(denied)).toBe(false)
      } finally {
        await ctx.fiber.dispose()
      }
    }
    completed = true
  } finally {
    writeFileSync(report, JSON.stringify({ completed, root, node: process.version, observations }, null, 2))
  }
}, 120_000)
