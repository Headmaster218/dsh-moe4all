/** Explicit copy-or-reference file admission for desktop/browser clients. */
import { useEffect, useRef, useState } from 'react'
import { Button, Modal, IconFolderOpenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceFileReply, WorkspaceFileOperation } from '@deepseek-ai/dsh-api-remotes/client'
import css from './LocalFiles.module.css'

/** Session-scoped file transport; the append operation rechecks input admission. */
export interface LocalFilesInjected {
  fileOperation: (operation: WorkspaceFileOperation, signal: AbortSignal) => Promise<WorkspaceFileReply>
  appendFile: (path: string) => void
}

/** Convert one browser file without loading remote URLs or interpreting its contents.
 * @param file - User-selected file.
 * @param signal - Admission cancellation.
 * @returns Canonical base64 for the bounded host upload.
 */
export function readLocalFile(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const reader = new FileReader()
    const abort = (): void => { reader.abort(); reject(signal.reason) }
    const done = (): void => { signal.removeEventListener('abort', abort) }
    reader.onload = () => { done(); resolve(String(reader.result).split(',')[1] ?? '') }
    reader.onerror = () => { done(); reject(reader.error) }
    reader.onabort = () => { done(); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    reader.readAsDataURL(file)
  })
}

/** Composer file action and two drop lanes; ordinary image drops retain image admission. */
export function LocalFiles({ input, session, fileOperation, appendFile, t }: LocalFilesInjected
  & Pick<PropsRuntime<'conversation.input.left'>, 'input' | 'session'> & PropsLocale<'conversation'>) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [path, setPath] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const locked = session.removed || input.phase === 'submitting' || input.phase === 'adjudicating'
  const close = (): void => { request.current?.abort(); setOpen(false); setBusy(false); setProgress('') }
  useEffect(() => () => { request.current?.abort() }, [])
  const copy = async (files: readonly File[]): Promise<void> => {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null); setOpen(true)
    try {
      for (const [index, file] of files.entries()) {
        controller.signal.throwIfAborted()
        setProgress(`${index + 1}/${files.length} ${file.name}`)
        if (file.size > 32 * 1024 * 1024) throw new Error(t('files.tooLarge'))
        const dataBase64 = await readLocalFile(file, controller.signal)
        const reply = await fileOperation({ kind: 'upload', name: file.name, dataBase64 }, controller.signal)
        controller.signal.throwIfAborted()
        if (reply.kind !== 'imported') throw new Error(t('files.failed'))
        appendFile(reply.path)
        setPending(current => current.filter(candidate => candidate !== file))
      }
      close()
    } catch (cause: unknown) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    } finally { if (request.current === controller) { setBusy(false); setProgress('') } }
  }
  const reference = async (): Promise<void> => {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null)
    try {
      const cleaned = path.trim().replace(/^"(.*)"$/, '$1')
      const reply = await fileOperation({ kind: 'reference', path: cleaned }, controller.signal)
      controller.signal.throwIfAborted()
      if (reply.kind !== 'imported') throw new Error(t('files.failed'))
      appendFile(reply.path)
      setPath(''); close()
    } catch (cause: unknown) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    } finally { if (request.current === controller) setBusy(false) }
  }
  useEffect(() => {
    const isFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes('Files') === true
    const enter = (event: DragEvent): void => {
      if (isFiles(event) && !locked && [...event.dataTransfer!.items].some(item => item.kind === 'file' && !item.type.startsWith('image/'))) setDragging(true)
    }
    const leave = (event: DragEvent): void => {
      if (event.relatedTarget === null && (event.clientX <= 0 || event.clientY <= 0)) setDragging(false)
    }
    const drop = (event: DragEvent): void => {
      setDragging(false)
      if (!isFiles(event)) return
      const files = [...event.dataTransfer!.files]
      if (files.length === 0 || files.every(file => file.type.startsWith('image/'))) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (locked || busy) return
      setPending(files); setError(null); setOpen(true)
      if (event.clientX < window.innerWidth / 2) void copy(files)
      else {
        const nativePath = (files[0] as File & { path?: string }).path
        setPath(nativePath ?? '')
      }
    }
    const reset = (): void => { setDragging(false) }
    document.addEventListener('dragenter', enter)
    document.addEventListener('dragleave', leave)
    document.addEventListener('drop', drop, true)
    window.addEventListener('dragend', reset)
    return () => {
      document.removeEventListener('dragenter', enter); document.removeEventListener('dragleave', leave)
      document.removeEventListener('drop', drop, true); window.removeEventListener('dragend', reset)
    }
  }, [locked, busy, fileOperation, appendFile, t])
  return <>
    <Button variant="ghost" size="sm" disabled={locked} aria-label={t('files.title')} title={t('files.title')}
      onClick={() => { setOpen(true); setError(null) }}><IconFolderOpenOutline16 /></Button>
    {dragging && <div className={css.drop} aria-hidden="true">
      <div>{t('files.copy')}</div><div>{t('files.reference')}</div>
    </div>}
    <Modal open={open} onClose={close} title={t('files.title')} closeLabel={t('close')}
      footer={<Button variant="outline" onClick={close}>{t('cancel')}</Button>}>
      <div className={css.columns}>
        <section className={css.section}>
          <h3>{t('files.copy')}</h3>
          <input ref={picker} type="file" multiple hidden onChange={event => {
            setPending([...event.target.files ?? []]); event.target.value = ''
          }} />
          <Button variant="outline" disabled={busy || locked} onClick={() => { picker.current?.click() }}>{t('files.choose')}</Button>
          <ul>{pending.map((file, index) => <li key={`${index}:${file.name}`}>{file.name}</li>)}</ul>
          <Button variant="primary" disabled={busy || locked || pending.length === 0} onClick={() => { void copy(pending) }}>{t('files.copy')}</Button>
        </section>
        <section className={css.section}>
          <h3>{t('files.reference')}</h3>
          <input className={css.path} value={path} disabled={busy || locked} aria-label={t('files.path')}
            placeholder={t('files.path')} onChange={event => { setPath(event.target.value) }} />
          <Button variant="outline" disabled={busy || locked || path.trim() === ''} onClick={() => { void reference() }}>{t('files.reference')}</Button>
        </section>
      </div>
      {busy && <div role="status">{progress || t('loading')}</div>}
      {error !== null && <div role="alert" className={css.error}>{error}</div>}
    </Modal>
  </>
}
