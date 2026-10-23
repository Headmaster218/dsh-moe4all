/** Opt-in real Windows compatibility matrix. Failures are observations, not permission fallbacks. */
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

it.skipIf(!enabled)('records a real restricted-token compatibility matrix without changing its backend', async () => {
  const reportPath = process.env.DSH_SANDBOX_COMPAT_REPORT
  const python = process.env.DSH_TEST_PYTHON
  if (!reportPath || !python || !existsSync(python)) throw new Error('Set DSH_SANDBOX_COMPAT_REPORT and an existing DSH_TEST_PYTHON')
  const root = mkdtempSync(join(tmpdir(), 'sandbox-compat-'))
  const workspace = join(root, 'workspace')
  mkdirSync(workspace)
  const ctx = new Context()
  const observations: { id: string; mode: string; result?: ShellRunResult; error?: string }[] = []
  let completed = false
  try {
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(LocalSandboxProvider)
    await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: workspace })
    await ctx.plugin(SandboxPwshExecutor, { timeoutMs: 15_000, maxTimeoutMs: 20_000, maxOutputBytes: 12_000, graceMs: 300 })
    const shell = ctx.shell as SandboxPwshExecutor
    const run = async (id: string, command: string, mode: 'workspace-write' | 'danger-full-access' | 'read-only', env?: Record<string, string>) => {
      try {
        const result = await shell.run(shell.resolve({
          command, workdir: workspace, sandboxPolicy: { mode, workspaceRoot: workspace },
          ...env === undefined ? {} : { env },
        }))
        observations.push({ id, mode, result })
        return result
      } catch (error) {
        observations.push({ id, mode, error: String(error) })
        return undefined
      }
    }
    const compare = async (id: string, command: string, env?: Record<string, string>) => {
      // The explicit host reference never retries or grants the restricted command.
      const confined = await run(id, command, 'workspace-write', env)
      const host = await run(id, command, 'danger-full-access', env)
      return { confined, host }
    }
    const nodeCommand = (program: string) => `& ${quote(process.execPath)} -e ${quote(program)}; exit $LASTEXITCODE`
    const pythonCommand = (program: string) => `& ${quote(python)} -c ${quote(program)}; exit $LASTEXITCODE`

    const utf8 = await compare('python-utf8', `${quote('\u4e2d\u6587')} | ${pythonCommand('import sys,json; print(json.dumps([ord(c) for c in sys.stdin.read().strip()])); print(chr(0x1f600))')}`)
    expect(utf8.host?.exitCode).toBe(0)
    expect(utf8.confined?.exitCode).toBe(0)
    expect(utf8.confined?.stdout.text).toContain('[20013, 25991]')
    expect(utf8.confined?.stdout.text).toContain('\uD83D\uDE00')

    await compare('python-child-capture', pythonCommand('import subprocess,sys; p=subprocess.run([sys.executable,"-c","print(123)"],capture_output=True,text=True); print(p.stdout.strip()); sys.exit(p.returncode)'))
    await compare('node-child-capture', nodeCommand('const r=require("node:child_process").spawnSync(process.execPath,["-e","console.log(123)"],{encoding:"utf8"}); console.log(JSON.stringify({status:r.status,error:r.error?.code,stdout:r.stdout})); process.exit(r.error?7:(r.status??8))'))
    await compare('node-child-inherit', nodeCommand('const r=require("node:child_process").spawnSync(process.execPath,["-e","console.log(123)"],{stdio:"inherit"}); process.exit(r.error?7:(r.status??8))'))
    writeFileSync(join(workspace, 'sample.test.cjs'), 'require("node:test")("sample",()=>require("node:assert/strict").equal(2+2,4));\n')
    await compare('node-test', `& ${quote(process.execPath)} --test ${quote(join(workspace, 'sample.test.cjs'))}; exit $LASTEXITCODE`)

    const url = 'https://registry.npmjs.org/is-number/latest'
    await compare('pwsh-https', `try { $r = Invoke-RestMethod -Uri ${quote(url)} -TimeoutSec 10 -ErrorAction Stop; Write-Output $r.name } catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 13 }`)
    await compare('node-https', nodeCommand(`const r=require('node:https').get(${JSON.stringify(url)},r=>{r.resume();r.on('end',()=>{console.log(r.statusCode);process.exit(r.statusCode===200?0:14)})});r.setTimeout(10000,()=>r.destroy(new Error('timeout')));r.on('error',e=>{console.error(e.stack);process.exit(15)})`))

    const uv = process.env.DSH_TEST_UV
    if (uv && existsSync(uv)) {
      const command = `& ${quote(uv)} python find --offline --no-python-downloads ${quote(python)}; exit $LASTEXITCODE`
      await compare('uv-outside-workspace-cache', command, { UV_CACHE_DIR: join(root, 'outside-uv-cache') })
      await compare('uv-workspace-cache', command, { UV_CACHE_DIR: join(workspace, 'uv-cache') })
    }

    const escape = join(root, 'outside.txt')
    const outside = await run('outside-write-denied', `try { Set-Content -LiteralPath ${quote(escape)} -Value bad -ErrorAction Stop } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 23 }`, 'workspace-write')
    expect(outside).toBeDefined()
    expect(outside?.exitCode).not.toBe(0)
    expect(existsSync(escape)).toBe(false)
    const allowed = join(workspace, 'inside.txt')
    expect((await run('workspace-write-allowed', `Set-Content -LiteralPath ${quote(allowed)} -Value ok -ErrorAction Stop`, 'workspace-write'))?.exitCode).toBe(0)
    expect(existsSync(allowed)).toBe(true)
    const readonly = join(workspace, 'readonly.txt')
    await run('readonly-write-denied', `try { Set-Content -LiteralPath ${quote(readonly)} -Value bad -ErrorAction Stop } catch { Write-Output $_.Exception.Message; exit 24 }`, 'read-only')
    expect(existsSync(readonly)).toBe(false)

    const controller = new AbortController()
    const pending = shell.run(shell.resolve({ command: 'Start-Sleep -Seconds 20', workdir: workspace,
      signal: controller.signal, sandboxPolicy: { mode: 'workspace-write', workspaceRoot: workspace } }))
    const timer = setTimeout(() => controller.abort(), 1500)
    try {
      const result = await pending
      observations.push({ id: 'cancel-confined-command', mode: 'workspace-write', result })
      expect(result.aborted).toBe(true)
      expect(result.timedOut).toBe(false)
    } finally {
      clearTimeout(timer)
    }
    completed = true
  } finally {
    await ctx.fiber.dispose()
    writeFileSync(reportPath, JSON.stringify({
      completed, root, node: process.version, python,
      scope: 'Compatibility observations, not a claim that every command works; no backend or authority change',
      observations,
    }, null, 2))
  }
}, 180_000)
