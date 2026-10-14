/** Desktop updates use the same Settings row and Modal primitives as the application. */
import { Button, Modal, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopController, DesktopPhase, DesktopState } from './desktop-controller.ts'
import type { SettingsKey } from './locales.ts'
import css from './DesktopSettingsRow.module.css'

type DesktopFace = { controller: DesktopController; hooks: { desktop: SnapshotStore<DesktopState> } }
type DesktopProps = InjectFace<DesktopFace> & PropsLocale<'settings'>
const phaseCopy: Record<DesktopPhase, SettingsKey> = {
  idle: 'desktop.idle', checking: 'desktop.checking', available: 'desktop.available', current: 'desktop.current',
  download: 'desktop.downloading', verify: 'desktop.verifying', extract: 'desktop.extracting', install: 'desktop.installing', error: 'desktop.error',
}

/**
 * Render the desktop-only update row and its controlled DSH dialog.
 * @param props - Framework-owned state hook, localized copy and injected controller.
 * @returns the Settings row with a shared Modal.
 */
export function DesktopSettingsRow({ useDesktop, controller, t }: DesktopProps) {
  const state = useDesktop(value => value)
  const busy = ['checking', 'download', 'verify', 'extract', 'install'].includes(state.phase)
  return (
    <div className={css.row}>
      <div><div className={css.title}>{t('desktop.title')}</div><div className={css.hint}>
        {state.installedVersion || 'MoE4All Agent'}{state.phase === 'idle' ? '' : ` · ${t(phaseCopy[state.phase])}`}
      </div></div>
      <Button variant="outline" onClick={() => busy || state.phase === 'available' ? controller.open() : controller.send('check')}>
        <IconRefreshOutline16 />{t(busy ? 'desktop.progress' : state.phase === 'available' ? 'desktop.viewUpdate' : 'desktop.check')}
      </Button>
    </div>
  )
}

/** Render a persistent settings notification, including while Settings is closed.
 * @param props - Shared desktop state and controller.
 * @returns the DSH update dialog.
 */
export function DesktopUpdateDialog({ useDesktop, controller, t }: DesktopProps) {
  const state = useDesktop(value => value)
  const busy = ['checking', 'download', 'verify', 'extract', 'install'].includes(state.phase)
  const progress = state.total > 0 ? Math.min(100, state.completed * 100 / state.total) : undefined
  return <Modal open={state.open} onClose={() => controller.close()} title={t('desktop.title')} closeLabel={t('close')}
      className={css.dialog!} description={t(phaseCopy[state.phase])} footer={<>
        {state.phase === 'available' && <Button variant="outline" title={t('desktop.check')} aria-label={t('desktop.check')} onClick={() => controller.send('check')}><IconRefreshOutline16 /></Button>}
        <Button variant="outline" onClick={() => controller.close()}>{t('close')}</Button>
        {state.phase === 'available' ? <Button variant="primary" onClick={() => controller.send('install')}>{t('desktop.install')}</Button>
          : !busy && <Button variant="primary" onClick={() => controller.send('check')}><IconRefreshOutline16 />{t('desktop.check')}</Button>}
      </>}>
      <dl className={css.versions}><div><dt>{t('desktop.installed')}</dt><dd>{state.installedVersion}</dd></div>
        {state.version && <div><dt>{t('desktop.newVersion')}</dt><dd>{state.version}</dd></div>}</dl>
      {state.phase === 'available' && <p className={css.hint}>{t('desktop.keepData')}</p>}
      {busy && <div className={css.progress}>
        <progress max="100" value={progress} aria-label={t(phaseCopy[state.phase])} />
        <span>{progress === undefined ? t('desktop.wait') : `${progress.toFixed(0)}%`}</span>
      </div>}
      {state.phase === 'error' && <p className={css.error}>{state.message || t('desktop.retry')}</p>}
      {state.phase === 'available' && <button type="button" className={css.link} onClick={() => controller.send('release')}>{t('desktop.release')}</button>}
    </Modal>
}
