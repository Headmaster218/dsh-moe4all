// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { Workbench } from '../src/client/workbench/Workbench.tsx'
import { htmlPreview, presentationPreview, previewAssetPath, PREVIEW_CSP, sandboxDocument } from '../src/client/workbench/preview.ts'
import type { PreviewFile } from '../src/client/workbench/preview.ts'
import { appliedChanges } from '../src/client/workbench/changes.ts'
import { createChatStore } from '../src/client/stores.ts'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en } from '../src/client/locales.ts'
import { en as common } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import type { WorkspaceFileOperation, WorkspaceFileReply } from '@deepseek-ai/dsh-api-remotes/client'

afterEach(() => { cleanup(); localStorage.clear() })
const t = makeTranslate(en, common)
const file = (path: string, text: string, mime = 'text/plain'): PreviewFile => ({ kind: 'file', path, mime, size: text.length,
  dataBase64: btoa(text) })
const signal = (): AbortSignal => new AbortController().signal

describe('workbench previews', () => {
  it('inlines only relative workspace assets and restricts iframe network/host access', async () => {
    const load = vi.fn(async () => file('images/a.png', 'pixel', 'image/png'))
    const html = await htmlPreview(file('slides/index.html', '<base href="https://remote/"><img src="../images/a.png"><img src="https://remote/private"><script>parent.test()</script>', 'text/html'), load, signal())
    expect(load).toHaveBeenCalledWith('images/a.png')
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('<base')
    expect(html).not.toContain('src="https://remote')
    expect(html).toContain("connect-src 'none'")
    expect(sandboxDocument('body').indexOf(PREVIEW_CSP)).toBeLessThan(sandboxDocument('body').indexOf('body'))
    expect(previewAssetPath('a/b.html', '../../secret')).toBeNull()
    expect(previewAssetPath('a/b.html', '//remote/a')).toBeNull()
  })
  it('converts a real small OOXML package with the pinned PPTX renderer', async () => {
    const data = zipSync({
      'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>'),
      'ppt/_rels/presentation.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>'),
      'ppt/slides/slide1.xml': strToU8('<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>MoE4All preview</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'),
    })
    const input: PreviewFile = { kind: 'file', path: 'deck.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: data.length,
      dataBase64: btoa(String.fromCharCode(...data)) }
    const slides = await presentationPreview(input, signal())
    expect(slides).toHaveLength(1)
    expect(slides[0]).toContain('MoE4All preview')
    expect(slides[0]).toContain('Content-Security-Policy')
  })
  it('refuses cancelled conversions and excessive ZIP expansion metadata before rendering', async () => {
    const bytes = zipSync({ 'part.xml': strToU8('small') })
    const view = new DataView(bytes.buffer)
    for (let index = 0; index < bytes.length - 28; index++) {
      if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 24, 65 * 1024 * 1024, true); break }
    }
    const input = { ...file('deck.pptx', ''), dataBase64: btoa(String.fromCharCode(...bytes)) }
    await expect(presentationPreview(input, signal())).rejects.toThrow('expands beyond')
    const controller = new AbortController(); controller.abort()
    await expect(presentationPreview(input, controller.signal)).rejects.toThrow()
  })
  it('opens and closes tabs and keeps HTML in an opaque sandbox', async () => {
    const store = createChatStore().create()
    store.actions.openWorkbenchFile('index.html')
    const fileOperation = vi.fn(async (operation: WorkspaceFileOperation): Promise<WorkspaceFileReply> => {
      if (operation.kind === 'list') return { kind: 'directory', path: '', entries: [], truncated: false }
      return file('index.html', '<h1>Local preview</h1>', 'text/html')
    })
    render(<Workbench useStore={bindSnapshotSelector(store)} actions={store.actions} t={t}
      fileOperation={fileOperation} getChanges={() => []} openNative={async () => {}} />)
    await waitFor(() => { expect(document.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts') })
    expect(document.querySelector('iframe')?.getAttribute('sandbox')).not.toContain('allow-same-origin')
    fireEvent.click(screen.getByLabelText('Close index.html'))
    await screen.findByText(en['workbench.selectFile'])
  })
  it('refreshes the selected file and reports a later read error', async () => {
    const store = createChatStore().create(); store.actions.openWorkbenchFile('notes.txt')
    let contents = 'first version'
    const operation = vi.fn(async (request: WorkspaceFileOperation): Promise<WorkspaceFileReply> => {
      if (request.kind === 'list') return { kind: 'directory', path: '', entries: [], truncated: false }
      if (contents === 'failed') throw new Error('File no longer exists')
      return file('notes.txt', contents)
    })
    render(<Workbench useStore={bindSnapshotSelector(store)} actions={store.actions} t={t}
      fileOperation={operation} getChanges={() => []} openNative={async () => {}} />)
    await screen.findByText('first version')
    contents = 'new contents'
    fireEvent.click(screen.getByRole('button', { name: en['workbench.refresh'] }))
    await screen.findByText('new contents')
    contents = 'failed'
    fireEvent.click(screen.getByRole('button', { name: en['workbench.refresh'] }))
    expect((await screen.findByRole('alert')).textContent).toBe('File no longer exists')
  })
  it('abandons a slow file read when moving to Git without leaving refresh disabled', async () => {
    const store = createChatStore().create(); store.actions.openWorkbenchFile('slow.html')
    let readSignal: AbortSignal | undefined
    const operation = vi.fn(async (request: WorkspaceFileOperation, signal: AbortSignal): Promise<WorkspaceFileReply> => {
      if (request.kind === 'list') return { kind: 'directory', path: '', entries: [], truncated: false }
      if (request.kind === 'git') return { kind: 'git', graph: '* ready', changes: [] }
      readSignal = signal
      return new Promise(() => {})
    })
    render(<Workbench useStore={bindSnapshotSelector(store)} actions={store.actions} t={t}
      fileOperation={operation} getChanges={() => []} openNative={async () => {}} />)
    await waitFor(() => { expect(readSignal).toBeDefined() })
    fireEvent.click(screen.getByRole('tab', { name: 'Git graph' }))
    await screen.findByText('* ready')
    expect(readSignal!.aborted).toBe(true)
    expect((screen.getByRole('button', { name: en['workbench.refresh'] }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('shows Git changes and fetches a literal per-file diff without any mutation commands', async () => {
    const store = createChatStore().create(); store.actions.setDetailsMode('git')
    const operation = vi.fn(async (request: WorkspaceFileOperation): Promise<WorkspaceFileReply> => request.kind === 'git'
      ? { kind: 'git', graph: '* abc123 subject', changes: [{ path: 'a.txt', status: ' M' }] }
      : { kind: 'diff', path: 'a.txt', text: '-before\n+after' })
    render(<Workbench useStore={bindSnapshotSelector(store)} actions={store.actions} t={t}
      fileOperation={operation} getChanges={() => []} openNative={async () => {}} />)
    await screen.findByText('* abc123 subject')
    fireEvent.click(screen.getByTitle('a.txt'))
    await waitFor(() => { expect(operation).toHaveBeenCalledWith({ kind: 'git-diff', path: 'a.txt' }, expect.any(AbortSignal)) })
  })
  it('collects only applied successful diffs, including nested calls', () => {
    const hunk = { path: 'a.txt', oldText: 'a', newText: 'b' }
    const nested = { kind: 'tool-result', seq: 2, callId: 'nested', isError: false, resultView: { card: 'diff', diffs: [hunk] }, subCalls: [] }
    const root = { kind: 'tool-result', seq: 3, callId: 'root', isError: true, resultView: { card: 'diff', diffs: [hunk] }, subCalls: [nested] }
    expect(appliedChanges({ nodes: { values: () => [{ kind: 'tool-call', location: { kind: 'step', turn: { turn: 4 } }, data: { root } }] } } as never))
      .toEqual([{ turn: 4, seq: 2, callId: 'nested', diffs: [hunk] }])
  })
})
