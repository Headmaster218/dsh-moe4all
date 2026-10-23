/** Environment discovery uses bounded process outcomes, not executable-file existence as health. */
import { describe, expect, it, vi } from 'vitest'
import type { ShellRunResult } from '@deepseek-ai/dsh-shell'
import { discoveryCommand, inspectEnvironment } from '../src/environment.ts'

const result = (value: unknown, overrides: Partial<ShellRunResult> = {}): ShellRunResult => ({
  exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 3000,
  stdout: { text: JSON.stringify(value), truncated: false }, stderr: { text: '', truncated: false }, ...overrides,
})
const discovery = (pythonCandidates: unknown[] = []) => result({ cwd: 'D:/work', shellVersion: '7.6', languageMode: 'ConstrainedLanguage',
  commands: { node: 'node.exe' }, cache: { uv: null }, pythonCandidates })

describe('shell environment inspection', () => {
  it('escapes an explicit path without adding PATH fallback or importing site packages', async () => {
    const run = vi.fn().mockResolvedValueOnce(discovery([{ path: "D:/my 'venv/python.exe", source: 'explicit' }]))
      .mockResolvedValueOnce(result({ executable: 'actual/python.exe', version: [3, 9, 13] }))
    const report = await inspectEnvironment(run, { python: "my 'venv/python.exe", maxCandidates: 4 })
    expect(run.mock.calls[0]?.[0]).toContain("'my ''venv/python.exe'")
    expect(run.mock.calls[0]?.[0]).not.toContain("@('python','python3')")
    expect(run.mock.calls[1]?.[0]).toContain("& 'D:/my ''venv/python.exe' -I -S -B -X utf8")
    expect(report.python).toMatchObject([{ source: 'explicit', startup: 'ok', executable: 'actual/python.exe', version: [3, 9, 13] }])
    expect(report).not.toHaveProperty('selectedInterpreter')
  })

  it('keeps failed project and working global environments distinct and bounds candidate execution', async () => {
    const run = vi.fn().mockResolvedValueOnce(discovery([
      { path: 'project/python.exe', source: 'project' }, { path: 'global/python.exe', source: 'PATH' },
      { path: 'global/python.exe', source: 'PATH' }, { path: 'other/python.exe', source: 'PATH' },
    ])).mockResolvedValueOnce(result(null, { exitCode: 9009, stderr: { text: 'private startup data', truncated: false } }))
      .mockResolvedValueOnce(result({ executable: 'global/python.exe', version: [3, 12, 1] }))
    const report = await inspectEnvironment(run, { maxCandidates: 2 })
    expect(run).toHaveBeenCalledTimes(3)
    expect(report.python).toMatchObject([{ startup: 'failed', source: 'project', exitCode: 9009 }, { startup: 'ok', source: 'PATH' }])
    expect(report.candidatesOmitted).toBe(1)
    expect(JSON.stringify(report)).not.toContain('private startup data')
    expect(report.note).toContain('do not silently replace a failed project environment')
  })

  it.each([
    { exitCode: 7 }, { timedOut: true }, { aborted: true }, { stdout: { text: '{}', truncated: true } },
    { stdout: { text: 'not JSON', truncated: false } },
    { sandbox: { mode: 'read-only' as const, denied: true } },
  ])('does not continue after incomplete discovery: %j', async overrides => {
    const run = vi.fn().mockResolvedValue(result({}, overrides))
    expect(await inspectEnvironment(run, { maxCandidates: 4 })).toMatchObject({ status: 'unavailable' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed fields and candidate sources', async () => {
    expect(await inspectEnvironment(async () => discovery([{ path: 'p', source: 'unknown' }]), { maxCandidates: 1 }))
      .toMatchObject({ status: 'unavailable' })
  })

  it('does not treat invalid interpreter JSON as usable startup', async () => {
    const run = vi.fn().mockResolvedValueOnce(discovery([{ path: 'p', source: 'PATH' }]))
      .mockResolvedValueOnce(result({ executable: 'p', version: ['3', 12, 1] }))
    expect((await inspectEnvironment(run, { maxCandidates: 1 })).python).toMatchObject([{ startup: 'failed' }])
  })

  it('looks for project candidates before PATH and never activates an environment', () => {
    const text = discoveryCommand()
    expect(text.indexOf('.venv/Scripts')).toBeLessThan(text.indexOf("@('python','python3')"))
    expect(text).not.toMatch(/Activate|conda run|pip install/)
  })
})
