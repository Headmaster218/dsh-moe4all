import { describe, expect, it } from 'vitest'
import { parseGitChanges, workspaceGit, workspaceGitDiff } from '../src/workspace-git.ts'

describe('read-only workspace Git', () => {
  it('keeps spaces, Unicode and rename destination paths without splitting filenames', () => {
    expect(parseGitChanges(' M has spaces.txt\0R  new name.txt\0old name.txt\0?? 中文.txt\0'))
      .toEqual([{ status: ' M', path: 'has spaces.txt' }, { status: 'R ', path: 'new name.txt' }, { status: '??', path: '中文.txt' }])
  })
  it('reads the current checkout graph without changing repository state', async () => {
    const before = await workspaceGit(process.cwd(), new AbortController().signal, 1024 * 1024)
    expect(before.kind).toBe('git')
    expect(before.graph).toContain('*')
    await expect(workspaceGitDiff(process.cwd(), '../outside', new AbortController().signal, 1024)).rejects.toThrow('Invalid')
  })
})
