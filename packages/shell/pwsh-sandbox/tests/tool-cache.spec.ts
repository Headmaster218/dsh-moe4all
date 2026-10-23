/** Opt-in real cache initialization and isolation; no downloads or package installs. */
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local'
import { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { SandboxPwshExecutor } from '../src/index.ts'

const enabled = process.platform === 'win32' && process.env.DSH_RUN_SANDBOX_COMPAT === '1'
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`
it.skipIf(!enabled)('initializes private tool caches, reuses a session root and preserves explicit cache denial', async () => {
  const uv = process.env.DSH_TEST_UV
  const python = process.env.DSH_TEST_PYTHON
  const report = process.env.DSH_TOOL_CACHE_REPORT
  if (!uv || !python || !report || !existsSync(uv) || !existsSync(python)) throw new Error('Set existing DSH_TEST_UV/PYTHON and DSH_TOOL_CACHE_REPORT')
  const root = mkdtempSync(join(tmpdir(), 'tool-cache-'))
  const workspace = join(root, 'workspace')
  mkdirSync(workspace)
  const keys = ['UV_CACHE_DIR', 'PIP_CACHE_DIR', 'npm_config_cache', 'NPM_CONFIG_CACHE']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  const ctx = new Context()
  const observations: unknown[] = []
  let completed = false
  try {
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(LocalSandboxProvider)
    await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: workspace })
    await ctx.plugin(SandboxPwshExecutor, { timeoutMs: 15_000, graceMs: 300 })
    const shell = ctx.shell as SandboxPwshExecutor
    const run = async (id: string, command: string, sessionId: string, env?: Record<string, string>, mode: 'workspace-write' | 'read-only' = 'workspace-write') => {
      const result = await shell.run(shell.resolve({ command, workdir: workspace, env,
        sandboxPolicy: { mode, workspaceRoot: workspace, sessionId: SessionId(sessionId) } }))
      observations.push({ id, result })
      return result
    }
    const program = 'const fs=require("node:fs"),path=require("node:path"); const caches={}; for(const k of ["UV_CACHE_DIR","PIP_CACHE_DIR","npm_config_cache"]){const p=process.env[k];fs.mkdirSync(p,{recursive:true});fs.writeFileSync(path.join(p,"sentinel"),"ok");caches[k]=p}console.log(JSON.stringify({temp:process.env.TEMP,caches}))'
    const command = `& ${quote(process.execPath)} -e ${quote(program)}; exit $LASTEXITCODE`
    const first = await run('default-cache-write', command, 'cache-a')
    expect(first.exitCode).toBe(0)
    const facts = JSON.parse(first.stdout.text) as { temp: string; caches: Record<string, string> }
    for (const path of Object.values(facts.caches)) {
      const suffix = relative(facts.temp, path)
      expect(isAbsolute(suffix) || suffix.startsWith('..')).toBe(false)
      expect(existsSync(join(path, 'sentinel'))).toBe(true)
    }
    const again = await run('same-session-cache', command, 'cache-a')
    expect(again.exitCode).toBe(0)
    expect(JSON.parse(again.stdout.text)).toEqual(facts)
    const second = await run('other-session-cache', command, 'cache-b')
    expect(second.exitCode).toBe(0)
    expect(JSON.parse(second.stdout.text).temp).not.toBe(facts.temp)
    const deniedPath = join(facts.caches.UV_CACHE_DIR!, 'peer-denied')
    const peer = await run('peer-cache-denied', `& ${quote(process.execPath)} -e ${quote(`require('node:fs').writeFileSync(${JSON.stringify(deniedPath)},'bad')`)}; exit $LASTEXITCODE`, 'cache-b')
    expect(peer.exitCode).not.toBe(0)
    expect(existsSync(deniedPath)).toBe(false)
    const uvCommand = `& ${quote(uv)} python find --offline --no-python-downloads ${quote(python)}; exit $LASTEXITCODE`
    expect((await run('uv-offline-default-cache', uvCommand, 'cache-a')).exitCode).toBe(0)
    const outside = join(root, 'explicit-outside-cache')
    expect((await run('explicit-cache-not-overridden', uvCommand, 'cache-a', { UV_CACHE_DIR: outside })).exitCode).not.toBe(0)
    expect(existsSync(outside)).toBe(false)
    const readonly = await run('readonly-no-cache-defaults', "Write-Output ($null -eq $env:UV_CACHE_DIR)", 'cache-a', undefined, 'read-only')
    expect(readonly.exitCode).toBe(0)
    expect(readonly.stdout.text.trim()).toBe('True')
    completed = true
  } finally {
    await ctx.fiber.dispose()
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
    writeFileSync(report, JSON.stringify({ completed, root, observations }, null, 2))
  }
}, 120_000)
