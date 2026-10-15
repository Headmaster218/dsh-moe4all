/** One DSH-themed chooser for workspaces, models and local Engine packages. */
import { useState } from 'react'
import { Button, Modal, IconFolderOpenOutline16, IconChevronUpOutline14, IconDataOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopController, DesktopState } from './desktop-controller.ts'
import css from './DesktopPicker.module.css'

type Props = InjectFace<{ controller: DesktopController; hooks: { desktop: SnapshotStore<DesktopState> } }> & PropsLocale<'settings'>

/** The shared Modal owns focus and dismissal; filesystem reads never block the browser thread. */
export function DesktopPicker({ useDesktop, controller, t }: Props) {
  const state = useDesktop(value => value.picker)
  const [address, setAddress] = useState<{ id: string; path: string; value: string }>()
  const [selection, setSelection] = useState<{ id: string; directory: string; path: string }>()
  const [folderName, setFolderName] = useState('')
  if (!state) return null
  const value = address?.id === state.id && address.path === state.path ? address.value : state.path
  const selected = selection?.id === state.id && selection.directory === state.path ? selection.path : ''
  const target = state.kind === 'directory' ? state.path : selected
  return <Modal open onClose={() => controller.pick('cancel')} title={t(`picker.${state.kind}`)} closeLabel={t('picker.cancel')}
    className={css.dialog!} contentClassName={css.content!}>
    <form className={css.navigation} onSubmit={event => { event.preventDefault(); controller.pick('list', value) }}>
      <select aria-label={t('picker.drives')} value="" onChange={event => { if (event.target.value) controller.pick('list', event.target.value) }}>
        <option value="" disabled>{t('picker.drives')}</option>{state.roots.map(root => <option value={root} key={root}>{root}</option>)}
      </select>
      <Button variant="ghost" size="sm" aria-label={t('picker.parent')} disabled={!state.parent || state.loading}
        onClick={() => controller.pick('list', state.parent)}><IconChevronUpOutline14 /></Button>
      <input aria-label={t('picker.path')} value={value} onChange={event => setAddress({ id: state.id, path: state.path, value: event.target.value })} />
      <Button type="submit" variant="outline" size="sm">{t('picker.go')}</Button>
    </form>
    {state.error && <div className={css.error} role="alert">{t('picker.error')}<details><summary>{t('cap.details')}</summary>{state.error}</details></div>}
    {state.loading && <p className={css.hint} role="status">{t('picker.loading')}</p>}
    <div className={css.files} role="list" aria-label={t('picker.entries')} aria-busy={state.loading}>
      {!state.loading && !state.error && state.entries.length === 0 && <p className={css.hint}>{t('picker.empty')}</p>}
      {state.entries.map(entry => <div key={entry.path} role="listitem">
        <button type="button" className={css.entry} aria-pressed={entry.directory ? undefined : selected === entry.path} disabled={state.loading}
          onClick={() => entry.directory ? controller.pick('list', entry.path) : setSelection({ id: state.id, directory: state.path, path: entry.path })}
          onDoubleClick={() => { if (!entry.directory) controller.pick('select', entry.path) }}>
          {entry.directory ? <IconFolderOpenOutline16 /> : <IconDataOutline16 />}<span>{entry.name}</span>{entry.directory && <span className={css.kind}>{t('picker.folder')}</span>}
        </button>
      </div>)}
    </div>
    <form className={css.navigation} onSubmit={event => { event.preventDefault(); if (folderName.trim()) { controller.pick('create', state.path, folderName.trim()); setFolderName('') } }}>
      <input aria-label={t('picker.newFolder')} placeholder={t('picker.newFolder')} value={folderName} onChange={event => setFolderName(event.target.value)} />
      <Button variant="outline" size="sm" type="submit" disabled={state.loading || !folderName.trim()}>{t('picker.create')}</Button>
    </form>
    {state.truncated && <p className={css.hint}>{t('picker.truncated')}</p>}
    <div className={css.footer}><span className={css.selection}>{selected || t(state.kind === 'model' ? 'picker.gguf' : state.kind === 'engine' ? 'picker.engineFilter' : 'picker.directoryFilter')}</span>
      <Button variant="ghost" onClick={() => controller.pick('cancel')}>{t('picker.cancel')}</Button>
      <Button variant="primary" disabled={!target || state.loading || !!state.error} onClick={() => controller.pick('select', target)}>{t('picker.select')}</Button>
    </div>
  </Modal>
}
