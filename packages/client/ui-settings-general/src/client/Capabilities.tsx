/** Agent-owned update presentation inside the existing Settings and Modal composition. */
import { useState } from 'react'
import { Button, Modal, Tooltip, IconRefreshOutline16, IconDownloadOutline16, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopController, DesktopState } from './desktop-controller.ts'
import type { CapabilityRow } from './capability-contract.ts'
import type { SettingsKey } from './locales.ts'
import css from './Capabilities.module.css'

type Face = { controller: DesktopController; hooks: { desktop: SnapshotStore<DesktopState> } }
type Props = InjectFace<Face> & PropsLocale<'settings'>
type Confirm = { kind: 'install'; row: CapabilityRow } | { kind: 'restart' } | { kind: 'rollback' }
const progressPhases = new Set(['download', 'downloading', 'prepare', 'verify', 'verifying', 'extract', 'extracting', 'install', 'installing', 'finalizing'])
const phases: Record<string, SettingsKey> = {
  checking: 'cap.checking', available: 'cap.update', current: 'cap.current', download: 'cap.downloading', downloading: 'cap.downloading',
  verify: 'cap.verifying', verifying: 'cap.verifying', prepare: 'cap.preparing', extract: 'cap.extracting', extracting: 'cap.extracting',
  install: 'cap.installing', installing: 'cap.installing', finalizing: 'cap.installing', ready: 'cap.ready', 'awaiting-health': 'cap.waitingHealth',
  complete: 'cap.complete', cancelled: 'cap.cancelled', 'rolled-back': 'cap.rolledBack', error: 'cap.error',
}
const names: Record<string, SettingsKey> = { engine: 'cap.engineName', 'dsh-llm-moe4all': 'cap.manager', 'dsh-mneme-moe4all': 'cap.mneme',
  'dsh-market-moe4all': 'cap.market', 'dsh-remote-web-ui-moe4all': 'cap.remote', 'dsh-plugin-cron-moe4all': 'cap.cron',
  'dsh-plugin-tts-moe4all': 'cap.tts', 'dsh-easyrewrite-moe4all': 'cap.rewrite', 'dsh-web-search-brave-moe4all': 'cap.brave' }
const descriptions: Record<string, SettingsKey> = { agent: 'cap.agentInfo', engine: 'cap.engineInfo', 'dsh-llm-moe4all': 'cap.managerInfo',
  'dsh-mneme-moe4all': 'cap.mnemeInfo', 'dsh-market-moe4all': 'cap.marketInfo', 'dsh-remote-web-ui-moe4all': 'cap.remoteInfo',
  'dsh-plugin-cron-moe4all': 'cap.cronInfo', 'dsh-plugin-tts-moe4all': 'cap.ttsInfo', 'dsh-easyrewrite-moe4all': 'cap.rewriteInfo',
  'dsh-web-search-brave-moe4all': 'cap.braveInfo' }

function agentRow(state: DesktopState): CapabilityRow {
  return { id: 'agent', kind: 'agent', zh: 'MoE4All Agent', en: 'MoE4All Agent', installedVersion: state.installedVersion, latestVersion: state.version,
    updateAvailable: state.phase === 'available', rollbackAvailable: false, pending: false, phase: state.phase, error: state.phase === 'error' ? state.message : '',
    completed: state.completed, total: state.total, releaseUrl: 'https://github.com/Headmaster218/MoE4All-Agent/releases' }
}

/** Render the same feature inside the Settings section and the automatic notification dialog. */
function Content({ state, controller, t }: { state: DesktopState; controller: DesktopController; t: Props['t'] }) {
  const [confirmation, setConfirmation] = useState<Confirm>()
  const snapshot = state.capabilities
  const busy = !!state.capabilityBusy || progressPhases.has(state.phase) || state.phase === 'checking'
  const pending = snapshot?.pending === true
  const rows = [agentRow(state), ...(snapshot?.engine ? [snapshot.engine] : []), ...(snapshot?.plugins ?? [])]
  const confirmCopy: SettingsKey = confirmation?.kind === 'restart' ? 'cap.confirmRestart' : confirmation?.kind === 'rollback' ? 'cap.confirmRollback'
    : confirmation?.row.kind === 'agent' ? 'cap.confirmAgent' : confirmation?.row.kind === 'engine' ? 'cap.confirmEngine' : 'cap.confirmPlugin'
  const confirm = () => {
    if (!confirmation) return
    if (confirmation.kind === 'install') {
      const row = confirmation.row
      if (row.kind === 'agent') controller.send('install', row.latestVersion)
      else controller.command(row.kind === 'engine' ? 'engine-install' : 'prepare', { id: row.id, version: row.latestVersion, confirmed: true })
    } else controller.command(confirmation.kind, { confirmed: true })
    setConfirmation(undefined)
  }
  const name = (row: CapabilityRow) => names[row.id] ? t(names[row.id]!) : row.en
  if (confirmation) return <section className={css.confirmStep} aria-label={t('cap.confirm')}>
    <h3 className={css.heading}>{t('cap.confirm')}</h3>
    {confirmation.kind === 'install' && <p className={css.target}>{name(confirmation.row)}<span>{confirmation.row.latestVersion}</span></p>}
    <p className={css.confirmText}>{t(confirmCopy)}</p>
    <div className={css.confirmActions}><Button variant="ghost" onClick={() => setConfirmation(undefined)}>{t('cap.notNow')}</Button>
      <Button variant="primary" disabled={busy} onClick={confirm}>{t(confirmation.kind === 'restart' ? 'cap.restart' : confirmation.kind === 'rollback' ? 'cap.rollback' : 'cap.confirmDownload')}</Button></div>
  </section>
  return <div className={css.center}>
    <div className={css.toolbar}>
      <div className={css.preferences}>
        <label><input type="checkbox" checked={snapshot?.settings.autoCheck ?? true} disabled={busy || !snapshot}
          onChange={event => controller.command('settings', { autoCheck: event.target.checked, preview: snapshot?.settings.preview ?? false })} />{t('cap.auto')}</label>
        <label><input type="checkbox" checked={snapshot?.settings.preview ?? false} disabled={busy || !snapshot}
          onChange={event => controller.command('settings', { autoCheck: snapshot?.settings.autoCheck ?? true, preview: event.target.checked })} />{t('cap.preview')}</label>
      </div>
      <Tooltip label={t('cap.check')} side="bottom"><span className={css.iconWrap}><Button variant="outline" size="sm" className={css.iconButton} aria-label={t('cap.check')}
        disabled={busy} onClick={() => controller.command('check')}><IconRefreshOutline16 /></Button></span></Tooltip>
    </div>
    {!snapshot && <p className={css.hint} role="status">{t('cap.loading')}</p>}
    {state.capabilityError && <p className={css.error} role="alert">{state.capabilityError}</p>}
    <ul className={css.list}>
      {rows.map(row => {
        const skipped = snapshot?.settings.skipped[row.id] === row.latestVersion && !!row.latestVersion
        const active = progressPhases.has(row.phase)
        const download = row.updateAvailable && !pending && !busy && !active && !row.managerUpdateRequired
        const progress = row.total > 0 ? Math.min(100, row.completed * 100 / row.total) : undefined
        const phase = row.error ? (row.kind === 'plugin' ? 'cap.failed' : 'cap.error') : row.pending ? 'cap.ready' : active ? phases[row.phase]! : skipped && row.updateAvailable ? 'cap.skipped' : row.updateAvailable ? 'cap.update' : phases[row.phase] ?? 'cap.idle'
        const url = /^https:\/\/github\.com\/Headmaster218\/[a-z0-9_-]+\/releases(?:\/tag\/[a-z0-9.+-]+)?$/iu.test(row.releaseUrl) ? row.releaseUrl : undefined
        const hint: SettingsKey | undefined = row.managerUpdateRequired ? 'cap.managerRequired' : row.pending ? 'cap.preparedInfo'
          : row.error && row.kind === 'plugin' ? 'cap.failedInfo' : active && row.kind === 'plugin' ? 'cap.preparingInfo'
          : row.phase === 'complete' ? 'cap.appliedInfo' : row.phase === 'rolled-back' ? 'cap.restoredInfo' : undefined
        return <li className={css.item} key={row.id} data-capability={row.id} aria-label={name(row)}>
          <div className={css.group}>{t(row.kind === 'agent' ? 'cap.agent' : row.kind === 'engine' ? 'cap.engine' : 'cap.plugins')}</div>
          <div className={css.row}>
            <div className={css.name}>{name(row)}</div>
            <span className={row.error ? css.errorStatus : row.updateAvailable && !skipped ? css.available : css.status}>{t(phase)}</span>
          </div>
          {descriptions[row.id] && <p className={css.description}>{t(descriptions[row.id]!)}</p>}
          <div className={css.versions}>
              <span>{row.installedVersion || t('cap.none')}</span>{row.latestVersion && row.latestVersion !== row.installedVersion && <><span aria-hidden="true">→</span><span>{row.latestVersion}</span></>}
          </div>
          {active && <div className={css.progress} role="status"><progress max="100" value={progress} aria-label={`${name(row)} ${t(phase)}`} />
            <span>{progress === undefined ? t(phase) : `${progress.toFixed(0)}% · ${(row.completed / 1048576).toFixed(1)} / ${(row.total / 1048576).toFixed(1)} MiB`}</span>
            {row.kind !== 'agent' && <Tooltip label={t('cap.cancel')}><span className={css.iconWrap}><Button size="sm" variant="ghost" className={css.iconButton} aria-label={t('cap.cancel')}
              onClick={() => controller.command(row.kind === 'engine' ? 'engine-cancel' : 'cancel')}><IconCloseOutline16 /></Button></span></Tooltip>}
          </div>}
          {hint && <p className={row.error ? css.error : css.hint} role="status">{t(hint)}</p>}
          {row.error && <details className={css.details}><summary>{t('cap.details')}</summary><p className={css.error}>{row.error}</p></details>}
          <div className={css.footer}>
            {url && <a className={css.release} href={url} target="_blank" rel="noreferrer">{t('cap.release')}</a>}
            <div className={css.actions}>
              {row.pending && <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => controller.command('cancel')}>{t('cap.cancel')}</Button>
                <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirmation({ kind: 'restart' })}>{t('cap.restart')}</Button>
              </>}
              {row.rollbackAvailable && !pending && <Tooltip label={t('cap.rollback')} side="top"><span className={css.iconWrap}><Button variant="ghost" size="sm" className={css.iconButton}
                aria-label={t('cap.rollback')} disabled={busy} onClick={() => setConfirmation({ kind: 'rollback' })}><IconRefreshOutline16 /></Button></span></Tooltip>}
              {row.updateAvailable && !row.pending && !active && !row.managerUpdateRequired && <>
                <Tooltip label={t(row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')} side="top"><span className={css.iconWrap}><Button variant="outline" size="sm" className={css.downloadButton}
                  aria-label={`${t(row.error ? 'cap.retry' : row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')} ${name(row)}`} disabled={!download}
                  onClick={() => setConfirmation({ kind: 'install', row })}><IconDownloadOutline16 />{t(row.error ? 'cap.retry' : row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')}</Button></span></Tooltip>
                {!skipped && <Button variant="ghost" size="sm" className={css.skip} disabled={busy} onClick={() => controller.skip(row.id, row.latestVersion)}>{t('cap.skip')}</Button>}
              </>}
            </div>
          </div>
        </li>
      })}
    </ul>
    {pending && !rows.some(row => row.pending) && <div className={css.pending} role="status"><span>{t('cap.pending')}</span><div className={css.pendingActions}>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => controller.command('cancel')}>{t('cap.cancel')}</Button>
      <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirmation({ kind: 'restart' })}>{t('cap.restart')}</Button>
    </div></div>}
  </div>
}

/** Settings navigation entry between Plugins and MoE4All; no separate native window. */
export function CapabilitiesSection({ useDesktop, controller, t }: Props) {
  const state = useDesktop(value => value)
  return <section className={css.section}><h2 className={css.heading}>{t('cap.title')}</h2><Content state={state} controller={controller} t={t} /></section>
}

/** Automatic update notification uses the shared DSH in-page Modal and can be reopened from Settings. */
export function CapabilitiesDialog({ useDesktop, controller, t }: Props) {
  const state = useDesktop(value => value)
  return <Modal open={state.open} onClose={() => controller.close()} title={t('cap.title')} closeLabel={t('cap.close')}
    className={css.dialog!} contentClassName={css.modalContent!}>
    <Content state={state} controller={controller} t={t} />
  </Modal>
}
