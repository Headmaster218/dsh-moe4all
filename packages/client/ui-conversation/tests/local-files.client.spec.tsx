// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalFiles } from '../src/client/files/LocalFiles.tsx'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en } from '../src/client/locales.ts'
import { en as common } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'

afterEach(cleanup)
const t = makeTranslate(en, common)
function bench(operation = vi.fn().mockResolvedValue({ kind: 'imported', path: '/work/notes.txt' })) {
  const appendFile = vi.fn()
  const view = render(<LocalFiles t={t} session={{ removed: false } as never} input={{ phase: 'plain' } as never}
    fileOperation={operation} appendFile={appendFile} />)
  fireEvent.click(screen.getByLabelText(en['files.title']))
  return { operation, appendFile, view }
}
describe('local files', () => {
  it('copies only selected bytes and appends the returned workspace path', async () => {
    const b = bench()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(b.view.container.querySelector('input[type=file]') ?? document.querySelector('input[type=file]')!, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: en['files.copy'] }))
    await waitFor(() => { expect(b.appendFile).toHaveBeenCalledWith('/work/notes.txt') })
    expect(b.operation).toHaveBeenCalledWith({ kind: 'upload', name: 'notes.txt', dataBase64: btoa('hello') }, expect.any(AbortSignal))
  })
  it('references a quoted original path without uploading any file bytes', async () => {
    const b = bench()
    fireEvent.change(screen.getByLabelText(en['files.path']), { target: { value: '"D:\\notes.txt"' } })
    fireEvent.click(screen.getByRole('button', { name: en['files.reference'] }))
    await waitFor(() => { expect(b.operation).toHaveBeenCalledWith({ kind: 'reference', path: 'D:\\notes.txt' }, expect.any(AbortSignal)) })
    expect(b.appendFile).toHaveBeenCalledOnce()
  })
  it('keeps the failed import visible without appending a path', async () => {
    const b = bench(vi.fn().mockRejectedValue(new Error('unreadable file')))
    fireEvent.change(screen.getByLabelText(en['files.path']), { target: { value: '/missing' } })
    fireEvent.click(screen.getByRole('button', { name: en['files.reference'] }))
    expect((await screen.findByRole('alert')).textContent).toBe('unreadable file')
    expect(b.appendFile).not.toHaveBeenCalled()
  })
  it('cancels a pending reference and ignores a late transport completion', async () => {
    let finish!: (reply: { kind: 'imported'; path: string }) => void
    const b = bench(vi.fn(() => new Promise(resolve => { finish = resolve })))
    fireEvent.change(screen.getByLabelText(en['files.path']), { target: { value: '/notes.txt' } })
    fireEvent.click(screen.getByRole('button', { name: en['files.reference'] }))
    await waitFor(() => { expect(b.operation).toHaveBeenCalledOnce() })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
    expect(b.operation.mock.calls[0]![1].aborted).toBe(true)
    finish({ kind: 'imported', path: '/notes.txt' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
    expect(b.appendFile).not.toHaveBeenCalled()
  })
  it('abandons an import when the same UI instance changes session', async () => {
    let finish!: (reply: { kind: 'imported'; path: string }) => void
    const b = bench(vi.fn(() => new Promise(resolve => { finish = resolve })))
    fireEvent.change(screen.getByLabelText(en['files.path']), { target: { value: '/notes.txt' } })
    fireEvent.click(screen.getByRole('button', { name: en['files.reference'] }))
    await waitFor(() => { expect(b.operation).toHaveBeenCalledOnce() })
    b.view.rerender(<LocalFiles t={t} session={{ removed: false, sessionId: 's2' } as never} input={{ phase: 'plain' } as never}
      fileOperation={b.operation} appendFile={b.appendFile} />)
    expect(b.operation.mock.calls[0]![1].aborted).toBe(true)
    finish({ kind: 'imported', path: '/notes.txt' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
    expect(b.appendFile).not.toHaveBeenCalled()
  })
})
