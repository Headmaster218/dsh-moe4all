/** Workspace files, sandbox previews, applied changes and read-only Git graph. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, CodeBlock, DiffBlock, MarkdownText, Modal, IconCloseOutline16, IconFolderOpenOutline16, IconFullscreenOutline16, IconRefreshOutline16, IconRightUpOutline16, IconChevronLeftOutline14, IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceFileOperation, WorkspaceFileReply, WorkspaceFileEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { ChatStore } from '../contract/slots.ts'
import type { AppliedChange } from './changes.ts'
import { htmlPreview, presentationPreview, previewBytes } from './preview.ts'
import type { PreviewFile } from './preview.ts'
import css from './Workbench.module.css'

/** The owning session's file transport and user-triggered change reader. */
export interface WorkbenchInjected {
  fileOperation: (operation: WorkspaceFileOperation, signal: AbortSignal) => Promise<WorkspaceFileReply>
  getChanges: () => AppliedChange[]
  openNative: (path: string) => Promise<void>
  /** Full-width entry closes the side panel to avoid duplicate active previews. */
  onActivate?: () => void
}

/** Workbench props come from the same session store in the side panel and expanded view. */
export type WorkbenchProps = PropsStore<ChatStore> & PropsLocale<'conversation'> & WorkbenchInjected

/** Toolbar action using the installed icon set. */
export function WorkbenchAction({ open, t }: { open: () => void } & PropsLocale<'conversation'>) {
  return <Button variant="ghost" size="sm" onClick={open} aria-label={t('workbench.title')} title={t('workbench.title')}><IconFolderOpenOutline16 /></Button>
}

type FilePreview = { file: PreviewFile; document?: string; slides?: string[] }

/** Mounted only while the files/changes/Git pane is visible. */
export function Workbench({ useStore, actions, fileOperation, getChanges, openNative, onActivate, t }: WorkbenchProps) {
  useEffect(() => { onActivate?.() }, [onActivate])
  const mode = useStore(s => s.detailsMode === 'tool' ? 'files' : s.detailsMode ?? 'files')
  const tabs = useStore(s => s.workbench?.paths ?? EMPTY_PATHS)
  const active = useStore(s => s.workbench?.active ?? null)
  const [directory, setDirectory] = useState('')
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([])
  const [truncated, setTruncated] = useState(false)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [page, setPage] = useState(0)
  const [source, setSource] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [reading, setReading] = useState(false)
  const [gitBusy, setGitBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const busy = reading || gitBusy
  const [error, setError] = useState<string | null>(null)
  const [git, setGit] = useState<Extract<WorkspaceFileReply, { kind: 'git' }> | null>(null)
  const [diff, setDiff] = useState<Extract<WorkspaceFileReply, { kind: 'diff' }> | null>(null)
  const [changes, setChanges] = useState<AppliedChange[]>([])
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null)
  const read = useRef<AbortController | null>(null)
  const listing = useRef<AbortController | null>(null)
  const operation = useRef<AbortController | null>(null)
  const failure = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)
  const list = async (path: string): Promise<void> => {
    listing.current?.abort(); const controller = new AbortController(); listing.current = controller
    try {
      const reply = await fileOperation({ kind: 'list', path }, controller.signal)
      if (controller.signal.aborted) return
      if (reply.kind !== 'directory') throw new Error(t('workbench.invalidReply'))
      setDirectory(reply.path); setEntries(reply.entries); setTruncated(reply.truncated)
    } catch (cause: unknown) { if (!controller.signal.aborted) setError(failure(cause)) }
  }
  const refreshGit = async (): Promise<void> => {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller
    setGitBusy(true); setError(null)
    try {
      const reply = await fileOperation({ kind: 'git' }, controller.signal)
      if (controller.signal.aborted) return
      if (reply.kind !== 'git') throw new Error(t('workbench.invalidReply'))
      setGit(reply); setDiff(null)
    } catch (cause: unknown) { if (!controller.signal.aborted) setError(failure(cause)) }
    finally { if (!controller.signal.aborted) setGitBusy(false) }
  }
  const showGitDiff = async (path: string): Promise<void> => {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller
    setGitBusy(true); setError(null)
    try {
      const reply = await fileOperation({ kind: 'git-diff', path }, controller.signal)
      if (controller.signal.aborted) return
      if (reply.kind !== 'diff') throw new Error(t('workbench.invalidReply'))
      setDiff(reply)
    } catch (cause: unknown) { if (!controller.signal.aborted) setError(failure(cause)) }
    finally { if (!controller.signal.aborted) setGitBusy(false) }
  }
  const refresh = (): void => {
    setError(null)
    if (mode === 'git') void refreshGit()
    else if (mode === 'changes') setChanges(getChanges())
    else { void list(directory); setRevision(current => current + 1) }
  }
  useEffect(() => {
    setGitBusy(false); setExpanded(false)
    refresh()
    return () => { operation.current?.abort() }
  }, [mode])
  useEffect(() => () => { read.current?.abort(); listing.current?.abort(); operation.current?.abort() }, [])
  useEffect(() => {
    read.current?.abort(); setPreview(null); setPage(0); setSource(false)
    if (active === null || mode !== 'files') { setReading(false); return }
    const controller = new AbortController(); read.current = controller
    setReading(true); setError(null)
    const load = async (path: string): Promise<PreviewFile> => {
      const reply = await fileOperation({ kind: 'read', path }, controller.signal)
      if (reply.kind !== 'file') throw new Error(t('workbench.invalidReply'))
      return reply
    }
    void load(active).then(async file => {
      const document = file.mime === 'text/html' ? await htmlPreview(file, load, controller.signal) : undefined
      const slides = file.mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ? await presentationPreview(file, controller.signal) : undefined
      if (!controller.signal.aborted) setPreview({ file, ...document === undefined ? {} : { document }, ...slides === undefined ? {} : { slides } })
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(failure(cause))
    }).finally(() => { if (!controller.signal.aborted) setReading(false) })
    return () => { controller.abort() }
  }, [active, mode, revision, fileOperation, t])
  const raw = useMemo(() => preview?.file.mime.startsWith('text/') === true
    ? new TextDecoder().decode(previewBytes(preview.file.dataBase64)) : '', [preview?.file])
  const iframeDocument = preview?.slides?.[page] ?? preview?.document
  const body = preview === null ? null : source
    ? <CodeBlock code={raw} lang={preview.file.path.split('.').at(-1)} copyLabel={t('copy')} copiedLabel={t('copied')} />
    : iframeDocument !== undefined
      ? <iframe className={css.frame} title={preview.file.path} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={iframeDocument} />
      : preview.file.mime === 'text/markdown' ? <div className={css.markdown}><MarkdownText text={raw} /></div>
      : preview.file.mime === 'text/plain' ? <CodeBlock code={raw} lang={preview.file.path.split('.').at(-1)} copyLabel={t('copy')} copiedLabel={t('copied')} />
      : preview.file.mime.startsWith('image/') ? <img className={css.image} alt={preview.file.path} src={`data:${preview.file.mime};base64,${preview.file.dataBase64}`} />
      : <div className={css.empty}>{t('workbench.unsupported')}</div>
  const turns = [...new Set(changes.map(change => change.turn))].sort((a, b) => b - a)
  const visibleChanges = selectedTurn === null ? changes : changes.filter(change => change.turn === selectedTurn)
  return <div className={css.root}>
    <nav className={css.toolbar} role="tablist" aria-label={t('workbench.title')}>
      {(['files', 'changes', 'git'] as const).map(item => <button key={item} role="tab" aria-selected={mode === item}
        onClick={() => { actions.setDetailsMode(item) }}>{t(`workbench.${item}`)}</button>)}
    </nav>
    <div className={css.toolbar}>
      <Button variant="ghost" size="sm" onClick={refresh} disabled={busy} aria-label={t('workbench.refresh')} title={t('workbench.refresh')}><IconRefreshOutline16 /></Button>
      {active !== null && mode === 'files' && <>
        <Button variant="ghost" size="sm" aria-label={t('workbench.expand')} title={t('workbench.expand')} onClick={() => { setExpanded(true) }}><IconFullscreenOutline16 /></Button>
        <Button variant="ghost" size="sm" aria-label={t('workbench.openNative')} title={t('workbench.openNative')} onClick={() => { void openNative(active).catch(cause => { setError(failure(cause)) }) }}><IconRightUpOutline16 /></Button>
        {preview !== null && preview.file.mime.startsWith('text/') && <label><input type="checkbox" checked={source} onChange={event => { setSource(event.target.checked) }} />{t('workbench.source')}</label>}
      </>}
    </div>
    {busy && <div role="status">{t('loading')}</div>}
    {error !== null && <div className={css.error} role="alert">{error}</div>}
    {mode === 'files' && <>
      <div className={css.tabs} role="tablist" aria-label={t('workbench.openFiles')}>
        {tabs.map(path => <div key={path} className={css.tab}>
          <button role="tab" aria-selected={active === path} title={path} onClick={() => { actions.openWorkbenchFile(path) }}>{path.replaceAll('\\', '/').split('/').at(-1)}</button>
          <button aria-label={`${t('close')} ${path}`} onClick={() => { actions.closeWorkbenchFile(path) }}><IconCloseOutline16 size={12} /></button>
        </div>)}
      </div>
      <details open={active === null} className={css.browser}>
        <summary>{directory || t('workbench.workspace')}</summary>
        <div className={css.directoryActions}><button onClick={() => { void list('') }}>{t('workbench.workspace')}</button>
          {directory !== '' && <button onClick={() => { void list(directory.replaceAll('\\', '/').split('/').slice(0, -1).join('/')) }}>{t('workbench.parent')}</button>}</div>
        <ul>{entries.map(entry => <li key={entry.path}><button title={entry.path} onClick={() => {
          if (entry.directory) void list(entry.path)
          else actions.openWorkbenchFile(entry.path)
        }}>{entry.directory && <IconFolderOpenOutline16 />}{entry.name}</button></li>)}</ul>
        {truncated && <div>{t('workbench.truncated')}</div>}
      </details>
      {preview?.slides !== undefined && <div className={css.toolbar}>
        <button aria-label={t('workbench.previous')} title={t('workbench.previous')} disabled={page === 0} onClick={() => { setPage(current => current - 1) }}><IconChevronLeftOutline14 /></button>
        <span>{page + 1} / {preview.slides.length}</span>
        <button aria-label={t('workbench.next')} title={t('workbench.next')} disabled={page + 1 >= preview.slides.length} onClick={() => { setPage(current => current + 1) }}><IconChevronRightOutline14 /></button>
      </div>}
      <div className={css.preview}>{!expanded && body}</div>
      {active === null && <div className={css.empty}>{t('workbench.selectFile')}</div>}
    </>}
    {mode === 'changes' && <div className={css.changes}>
      <select aria-label={t('workbench.turn')} value={selectedTurn ?? ''} onChange={event => { setSelectedTurn(event.target.value === '' ? null : Number(event.target.value)) }}>
        <option value="">{t('workbench.allTurns')}</option>
        {turns.map(turn => <option key={turn} value={turn}>{t('workbench.turn')} {turn}</option>)}
      </select>
      {visibleChanges.length === 0 && <div className={css.empty}>{t('workbench.noChanges')}</div>}
      {visibleChanges.map(change => <section key={change.callId}>
        <h3>{t('workbench.turn')} {change.turn} · #{change.seq}</h3>
        {change.diffs.map((hunk, index) => <div key={`${hunk.path}:${index}`}>
          <button title={hunk.path} onClick={() => { actions.openWorkbenchFile(hunk.path) }}>{hunk.path}</button>
          <DiffBlock diffs={[hunk]} maxLines={80} />
        </div>)}
      </section>)}
    </div>}
    {mode === 'git' && <div className={css.git}>
      {git !== null && <>
        <pre aria-label="Git graph">{git.graph || t('workbench.noCommits')}</pre>
        <ul>{git.changes.map(change => <li key={change.path}><button title={change.path} onClick={() => { void showGitDiff(change.path) }}><code>{change.status}</code> {change.path}</button></li>)}</ul>
        {git.changes.length === 0 && <div>{t('workbench.clean')}</div>}
      </>}
      {diff !== null && <CodeBlock code={diff.text || t('workbench.noChanges')} lang="diff" copyLabel={t('copy')} copiedLabel={t('copied')} />}
    </div>}
    <Modal open={expanded} onClose={() => { setExpanded(false) }} title={active ?? t('workbench.title')}
      closeLabel={t('close')} className={css.expanded!}>
      <div className={css.expandedPreview}>{body}</div>
      {preview?.slides !== undefined && <div className={css.toolbar}>
        <button aria-label={t('workbench.previous')} title={t('workbench.previous')} disabled={page === 0} onClick={() => { setPage(current => current - 1) }}><IconChevronLeftOutline14 /></button>
        <span>{page + 1} / {preview.slides.length}</span>
        <button aria-label={t('workbench.next')} title={t('workbench.next')} disabled={page + 1 >= preview.slides.length} onClick={() => { setPage(current => current + 1) }}><IconChevronRightOutline14 /></button>
      </div>}
    </Modal>
  </div>
}
const EMPTY_PATHS: readonly string[] = []
