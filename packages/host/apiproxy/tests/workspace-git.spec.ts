import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseGitChanges, workspaceGit, workspaceGitDiff } from '../src/workspace-git.ts'

describe('read-only workspace Git', () => {
  it('keeps spaces, Unicode and rename destination paths without splitting filenames', () => {
    expect(parseGitChanges(' M has spaces.txt\0R  new name.txt\0old name.txt\0?? 中文.txt\0'))
      .toEqual([{ status: ' M', path: 'has spaces.txt' }, { status: 'R ', path: 'new name.txt' }, { status: '??', path: '中文.txt' }])
  })
  it('reads an isolated fixture graph without changing repository state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-workbench-git-'))
    const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=', '-c', 'init.templateDir=',
      '-c', 'commit.gpgSign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-C', root, ...args],
    { encoding: 'utf8', windowsHide: true })
    try {
      git('init', '--quiet')
      git('commit', '--quiet', '--allow-empty', '-m', 'workbench fixture')
      writeFileSync(join(root, 'has spaces.txt'), 'fixture\n')
      const before = git('status', '--porcelain=v1', '-z')
      const result = await workspaceGit(root, new AbortController().signal, 1024 * 1024)
      expect(result.kind).toBe('git')
      expect(result.graph).toContain('workbench fixture')
      expect(result.changes).toEqual([{ status: '??', path: 'has spaces.txt' }])
      expect((await workspaceGitDiff(root, 'has spaces.txt', new AbortController().signal, 1024)).text).toContain('+fixture')
      await expect(workspaceGitDiff(root, '../outside', new AbortController().signal, 1024)).rejects.toThrow('Invalid')
      expect(git('status', '--porcelain=v1', '-z')).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
