/** Searchable question directory; opening it does not render historical replies. */
import { useEffect, useRef, useState } from 'react'
import { Button, Modal, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuestionEntry } from './questions.ts'
import css from './QuestionDirectory.module.css'

/** Injected session-authorized navigation operations. */
export interface QuestionDirectoryInjected {
  loadQuestions: (signal: AbortSignal) => Promise<QuestionEntry[]>
  navigate: (seq: number, signal: AbortSignal) => Promise<void>
}

/** Header action and its compact user-message search dialog. */
export function QuestionDirectory({ loadQuestions, navigate, t }: QuestionDirectoryInjected & PropsLocale<'conversation'>) {
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<QuestionEntry[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const close = (): void => { request.current?.abort(); setOpen(false); setBusy(false) }
  const load = (): void => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setOpen(true); setBusy(true); setError(null)
    void loadQuestions(controller.signal).then(items => {
      if (!controller.signal.aborted) { setQuestions(items); setBusy(false) }
    }, (cause: unknown) => {
      if (!controller.signal.aborted) { setError(String(cause instanceof Error ? cause.message : cause)); setBusy(false) }
    })
  }
  const go = (seq: number): void => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError(null)
    void navigate(seq, controller.signal).then(() => {
      if (!controller.signal.aborted) close()
    }, (cause: unknown) => {
      if (!controller.signal.aborted) { setError(String(cause instanceof Error ? cause.message : cause)); setBusy(false) }
    })
  }
  const visible = questions.filter(item => item.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <>
    <Button variant="ghost" size="sm" aria-label={t('questions.title')} title={t('questions.title')} onClick={load}>
      <IconSearchOutline16 />
    </Button>
    <Modal open={open} onClose={close} closeLabel={t('close')} title={t('questions.title')}>
      <div className={css.root}>
        <input className={css.search} type="search" autoFocus value={query} aria-label={t('questions.search')}
          placeholder={t('questions.search')} onChange={event => { setQuery(event.target.value) }} />
        {busy && <div role="status">{t('questions.loading')}</div>}
        {error !== null && <div role="alert">{error}<Button variant="ghost" onClick={load}>{t('retry')}</Button></div>}
        <ol className={css.list}>
          {visible.map(item => <li key={item.seq}>
            <button className={css.question} disabled={busy} onClick={() => { go(item.seq) }}>
              <time>{new Date(item.time).toLocaleString()}</time>
              <span>{item.text || t('questions.attachment')}</span>
            </button>
          </li>)}
        </ol>
        {!busy && visible.length === 0 && <div>{t('questions.empty')}</div>}
      </div>
    </Modal>
  </>
}
