import { mkdtemp, mkdir, writeFile, readFile, symlink, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { workspaceFiles, validUploadName } from '../src/workspace-files.ts'
import { hostWorkspaceFilesRequestSchema } from '../src/api/host.schema.ts'
import type { WorkspaceFileRequest } from '../src/api/workspace-files.ts'
const limits = { maxBytes: 1024, maxEntries: 2 }
const signal = (): AbortSignal => new AbortController().signal

describe('workspace files', () => {
  it('uploads into unique workspace directories and never overwrites a same-name input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-files-'))
    const upload = { sessionId: 's1', kind: 'upload', name: 'notes.txt', dataBase64: Buffer.from('hello').toString('base64') } as WorkspaceFileRequest
    const first = await workspaceFiles(root, upload, limits, signal())
    const second = await workspaceFiles(root, upload, limits, signal())
    expect(first.kind).toBe('imported'); expect(second.kind).toBe('imported')
    if (first.kind !== 'imported' || second.kind !== 'imported') throw new Error('Expected imported file paths')
    expect(first.path).not.toBe(second.path)
    expect(await readFile(first.path, 'utf8')).toBe('hello')
    const preview = await workspaceFiles(root, { sessionId: 's1', kind: 'read', path: first.path } as WorkspaceFileRequest, limits, signal())
    expect(preview).toMatchObject({ kind: 'file', mime: 'text/plain', size: 5 })
  })
  it('rejects traversal, linked escapes, Git internals, invalid names and oversized uploads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-files-'))
    const outside = await mkdtemp(join(tmpdir(), 'workspace-outside-'))
    await writeFile(join(outside, 'secret.txt'), 'private')
    await mkdir(join(root, '.git')); await writeFile(join(root, '.git', 'config'), 'private')
    await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    for (const path of [join(outside, 'secret.txt'), 'linked/secret.txt', '.git/config']) {
      await expect(workspaceFiles(root, { sessionId: 's1', kind: 'read', path } as WorkspaceFileRequest, limits, signal())).rejects.toThrow()
    }
    for (const name of ['../x', 'a:b', 'CON.txt', 'aux', 'a.', 'a\n.txt']) expect(validUploadName(name)).toBe(false)
    await expect(workspaceFiles(root, { sessionId: 's1', kind: 'upload', name: 'large.txt', dataBase64: Buffer.alloc(1025).toString('base64') } as WorkspaceFileRequest, limits, signal())).rejects.toThrow('limit')
    for (const dataBase64 of ['!!!!', 'aGVsbG8', 'aGVsbG8=\n', 'Zh==']) {
      await expect(workspaceFiles(root, { sessionId: 's1', kind: 'upload', name: 'bad.txt', dataBase64 } as WorkspaceFileRequest, limits, signal())).rejects.toThrow('canonical')
    }
    const reference = await workspaceFiles(root, { sessionId: 's1', kind: 'reference', path: join(outside, 'secret.txt') } as WorkspaceFileRequest, limits, signal())
    expect(reference).toEqual({ kind: 'imported', path: await realpath(join(outside, 'secret.txt')) })
  })
  it('bounds directory output and honors cancelled requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-files-'))
    for (const name of ['a.txt', 'b.txt', 'c.txt']) await writeFile(join(root, name), name)
    expect(await workspaceFiles(root, { sessionId: 's1', kind: 'list', path: '' } as WorkspaceFileRequest, limits, signal()))
      .toMatchObject({ kind: 'directory', truncated: true, entries: [{ name: 'a.txt' }, { name: 'b.txt' }] })
    const controller = new AbortController(); controller.abort()
    await expect(workspaceFiles(root, { sessionId: 's1', kind: 'list', path: '' } as WorkspaceFileRequest, limits, controller.signal)).rejects.toThrow()
    expect(hostWorkspaceFilesRequestSchema.safeParse({ sessionId: 's1', kind: 'exec', command: 'anything' }).success).toBe(false)
  })
})
