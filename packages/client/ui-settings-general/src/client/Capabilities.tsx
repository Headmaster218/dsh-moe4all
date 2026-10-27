/** Agent-owned update presentation inside the existing Settings section. */
import { useEffect, useState } from 'react'
import { Button, Tooltip, IconRefreshOutline16, IconDownloadOutline16, IconCloseOutline16, IconDataOutline16, IconPersonalizationOutline16, IconAgentPresetOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopController, DesktopState } from './desktop-controller.ts'
import type { CapabilityRow } from './capability-contract.ts'
import type { SettingsKey } from './locales.ts'
import css from './Capabilities.module.css'

type Face = { controller: DesktopController; hooks: { desktop: SnapshotStore<DesktopState> } }
type Props = InjectFace<Face> & PropsLocale<'settings'>
type Confirm = { kind: 'install'; row: CapabilityRow } | { kind: 'restart' } | { kind: 'rollback' }
type View = 'all' | 'attention' | 'history'
const progressPhases = new Set(['download', 'downloading', 'prepare', 'snapshot', 'dependencies', 'validate', 'verify', 'verifying', 'extract', 'extracting', 'install', 'installing', 'finalizing'])
const phases: Record<string, SettingsKey> = {
  checking: 'cap.checking', available: 'cap.update', current: 'cap.current', download: 'cap.downloading', downloading: 'cap.downloading',
  verify: 'cap.verifying', verifying: 'cap.verifying', prepare: 'cap.preparing', extract: 'cap.extracting', extracting: 'cap.extracting',
  install: 'cap.installing', installing: 'cap.installing', finalizing: 'cap.installing', ready: 'cap.ready', 'awaiting-health': 'cap.waitingHealth',
  complete: 'cap.current', cancelled: 'cap.cancelled', 'rolled-back': 'cap.current', error: 'cap.error',
  snapshot: 'cap.snapshot', dependencies: 'cap.dependencies', validate: 'cap.validate',
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
    updateAvailable: state.phase === 'available' || (state.phase === 'error' && !!state.version && state.version !== state.installedVersion),
    rollbackAvailable: false, pending: false, phase: state.phase, error: state.phase === 'error' ? state.message : '',
    errorStage: state.version ? 'update' : 'check',
    completed: state.completed, total: state.total, releaseUrl: 'https://github.com/Headmaster218/MoE4All-Agent/releases' }
}

/** Component status and confirmed update actions share the Settings-owned section. */
function Content({ state, controller, t }: { state: DesktopState; controller: DesktopController; t: Props['t'] }) {
  const [confirmation, setConfirmation] = useState<Confirm>()
  const [view, setView] = useState<View>('all')
  const snapshot = state.capabilities
  const busy = !!state.capabilityBusy || progressPhases.has(state.phase) || state.phase === 'checking'
  const pending = snapshot?.pending === true
  const rows = [agentRow(state), ...(snapshot?.engine ? [snapshot.engine] : []), ...(snapshot?.plugins ?? [])]
  const skipped = (row: CapabilityRow) => !!row.latestVersion && snapshot?.settings.skipped[row.id] === row.latestVersion
  const needsAttention = (row: CapabilityRow) => !!row.error || row.pending || row.managerUpdateRequired || progressPhases.has(row.phase)
    || (row.updateAvailable && !skipped(row))
  const attention = rows.filter(needsAttention)
  const history = rows.filter(row => row.lastUpdate).sort((a, b) => b.lastUpdate!.at - a.lastUpdate!.at)
  const visible = view === 'attention' ? attention : rows
  const activeRow = rows.find(row => row.pending || progressPhases.has(row.phase))
  const summary: SettingsKey = pending ? 'cap.summaryRestart' : activeRow ? 'cap.summaryRunning'
    : attention.length ? 'cap.summaryAttention' : busy || snapshot?.checking ? 'cap.checking'
    : rows.some(row => row.phase === 'idle' || !row.phase) ? 'cap.summaryUnchecked' : 'cap.summaryCurrent'
  const date = (at: number) => new Intl.DateTimeFormat(t('cap.dateLocale'), { dateStyle: 'medium', timeStyle: 'short' }).format(at)
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
    <div className={css.overview} role="status">
      <div><div className={css.overviewTitle}>{t(summary)}</div>
        <p className={css.overviewDetail}>{pending ? t(activeRow?.pendingAction === 'rollback' ? 'cap.rollbackReadyInfo' : 'cap.preparedInfo') : activeRow ? name(activeRow)
          : attention.length ? `${attention.length} ${t('cap.toReview')}` : t(snapshot?.settings.preview ? 'cap.previewChannel' : 'cap.stableChannel')}</p></div>
      <div className={css.overviewActions}>{pending ? <>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => controller.command('cancel')}>{t('cap.cancel')}</Button>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirmation({ kind: 'restart' })}>{t('cap.restart')}</Button>
      </> : <Button variant="outline" size="sm" className={css.checkButton} disabled={busy} onClick={() => controller.command('check')}>
        <IconRefreshOutline16 />{t('cap.check')}</Button>}</div>
    </div>
    <div className={css.toolbar}>
      <div className={css.filters} role="group" aria-label={t('cap.views')}>
        {(['all', 'attention', 'history'] as const).map(id => <button type="button" key={id} aria-pressed={view === id}
          onClick={() => setView(id)}>{t(`cap.view.${id}`)}{' '}<span>{id === 'all' ? rows.length : id === 'attention' ? attention.length : history.length}</span></button>)}
      </div>
      <details className={css.settings}><summary>{t('cap.updateSettings')}</summary><div className={css.preferences}>
        <label><input type="checkbox" checked={snapshot?.settings.autoCheck ?? true} disabled={busy || !snapshot}
          onChange={event => controller.command('settings', { autoCheck: event.target.checked, preview: snapshot?.settings.preview ?? false })} />{t('cap.auto')}</label>
        <label><input type="checkbox" checked={snapshot?.settings.preview ?? false} disabled={busy || !snapshot}
          onChange={event => controller.command('settings', { autoCheck: snapshot?.settings.autoCheck ?? true, preview: event.target.checked })} />{t('cap.preview')}</label>
      </div></details>
    </div>
    {!snapshot && <p className={css.hint} role="status">{t('cap.loading')}</p>}
    {state.capabilityError && <p className={css.error} role="alert">{state.capabilityError}</p>}
    {view === 'history' ? <div className={css.history}>
      <p className={css.hint}>{t('cap.historyScope')}</p>
      {history.length === 0 && <p className={css.empty}>{t('cap.noHistory')}</p>}
      <ul className={css.historyList}>{history.map(row => <li key={row.id} className={css.historyRow}>
        <div><strong>{name(row)}</strong><p>{row.lastUpdate!.kind === 'rollback' && <span>{t('cap.rolledBack')} · </span>}{row.lastUpdate!.from} → {row.lastUpdate!.to}</p></div>
        <time dateTime={new Date(row.lastUpdate!.at).toISOString()}>{date(row.lastUpdate!.at)}</time>
        {row.rollbackAvailable && !pending && <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmation({ kind: 'rollback' })}>
          <IconRefreshOutline16 />{t('cap.rollback')}</Button>}
      </li>)}</ul>
    </div> : <>
    {view === 'attention' && visible.length === 0 && <p className={css.empty} role="status">{t('cap.noAttention')}</p>}
    <ul className={css.list}>
      {visible.map(row => {
        const isSkipped = skipped(row)
        const active = progressPhases.has(row.phase)
        const download = row.updateAvailable && !pending && !busy && !active && !row.managerUpdateRequired && !row.requiresStop
        const progress = row.total > 0 ? Math.min(100, row.completed * 100 / row.total) : undefined
        const checkFailed = !!row.error && row.errorStage === 'check'
        const phase = row.error ? (checkFailed ? 'cap.checkFailed' : row.kind === 'plugin' ? 'cap.failed' : 'cap.error')
          : row.pending ? 'cap.ready' : active ? phases[row.phase]! : row.externallyManaged ? 'cap.external'
          : isSkipped && row.updateAvailable ? 'cap.skipped' : row.updateAvailable ? 'cap.update'
          : !row.installedVersion ? 'cap.none' : phases[row.phase] ?? 'cap.idle'
        const url = /^https:\/\/github\.com\/Headmaster218\/[a-z0-9_-]+\/releases(?:\/tag\/[a-z0-9.+-]+)?$/iu.test(row.releaseUrl) ? row.releaseUrl : undefined
        const hint: SettingsKey | undefined = row.managerUpdateRequired ? 'cap.managerRequired' : row.requiresStop ? 'cap.stopEngine'
          : row.externallyManaged ? 'cap.externalInfo' : row.pending ? row.pendingAction === 'rollback' ? 'cap.rollbackReadyInfo' : 'cap.preparedInfo'
          : checkFailed ? 'cap.checkFailedInfo' : row.error && row.kind === 'plugin' ? 'cap.failedInfo' : active && row.kind === 'plugin' ? 'cap.preparingInfo'
          : undefined
        const step = row.pending ? 3 : ['prepare', 'snapshot', 'dependencies', 'validate', 'extract', 'extracting', 'install', 'installing', 'finalizing'].includes(row.phase) ? 2
          : ['verify', 'verifying'].includes(row.phase) ? 1 : 0
        return <li className={css.item} key={row.id} data-capability={row.id} data-attention={needsAttention(row) || undefined} aria-label={name(row)}>
          <div className={css.group}>{row.kind === 'agent' ? <IconAgentPresetOutline16 /> : row.kind === 'engine' ? <IconDataOutline16 /> : <IconPersonalizationOutline16 />}
            {t(row.kind === 'agent' ? 'cap.agent' : row.kind === 'engine' ? 'cap.engine' : 'cap.plugins')}</div>
          <div className={css.row}>
            <div className={css.name}>{name(row)}</div>
            <span className={row.error ? css.errorStatus : row.pending || row.updateAvailable && !isSkipped ? css.available : css.status}>{t(phase)}</span>
          </div>
          {descriptions[row.id] && <p className={css.description}>{t(descriptions[row.id]!)}</p>}
          <div className={css.versions}>
              <span className={css.versionLabel}>{t('cap.installed')}</span><span>{row.installedVersion || t('cap.none')}</span>
              {(row.pending && row.preparedVersion ? row.preparedVersion !== row.installedVersion : row.latestVersion && row.latestVersion !== row.installedVersion) && <>
                <span className={css.versionLabel}>{t(row.pending ? 'cap.preparedVersion' : 'cap.available')}</span><span>{row.pending && row.preparedVersion ? row.preparedVersion : row.latestVersion}</span></>}
          </div>
          {(active || row.pending) && row.kind === 'plugin' && <ol className={css.steps} aria-label={t('cap.updateStages')}>
            {(['cap.downloading', 'cap.verifying', 'cap.stagePrepare', 'cap.stageApply'] as const).map((key, index) => <li key={key}
              aria-current={index === step ? 'step' : undefined} data-past={index < step || undefined}>{t(key)}</li>)}
          </ol>}
          {active && <div className={css.progress} role="status"><progress max="100" value={progress} aria-label={`${name(row)} ${t(phase)}`} />
            <span>{row.phase === 'snapshot' ? `${t(phase)} · ${row.completed} / ${row.total}`
              : row.phase === 'validate' ? `${t(phase)} · ${row.completed} ${t('cap.files')}`
              : progress === undefined ? t(phase) : row.kind === 'agent' && row.phase === 'extract'
              ? `${progress.toFixed(0)}% · ${row.completed} / ${row.total} ${t('cap.files')}`
              : `${progress.toFixed(0)}% · ${(row.completed / 1048576).toFixed(1)} / ${(row.total / 1048576).toFixed(1)} MiB`}</span>
            {row.kind !== 'agent' && <Tooltip label={t('cap.cancel')}><span className={css.iconWrap}><Button size="sm" variant="ghost" className={css.iconButton} aria-label={t('cap.cancel')}
              onClick={() => controller.command(row.kind === 'engine' ? 'engine-cancel' : 'cancel')}><IconCloseOutline16 /></Button></span></Tooltip>}
          </div>}
          {hint && <p className={row.error ? css.error : css.hint} role="status">{t(hint)}</p>}
          {row.error && <details className={css.details}><summary>{t('cap.details')}</summary><p className={css.error}>{row.error}</p></details>}
          {row.lastUpdate && !active && !row.pending && <p className={css.historyStamp}>{t(row.lastUpdate.kind === 'rollback' ? 'cap.rolledBackAt' : 'cap.appliedAt')} <time dateTime={new Date(row.lastUpdate.at).toISOString()}>{date(row.lastUpdate.at)}</time></p>}
          <div className={css.footer}>
            {url && <a className={css.release} href={url} target="_blank" rel="noreferrer">{t('cap.release')}</a>}
            <div className={css.actions}>
              {row.pending && <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => controller.command('cancel')}>{t('cap.cancel')}</Button>
                <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirmation({ kind: 'restart' })}>{t('cap.restart')}</Button>
              </>}
              {row.rollbackAvailable && !pending && <Tooltip label={t('cap.rollback')} side="top"><span className={css.iconWrap}><Button variant="ghost" size="sm" className={css.iconButton}
                aria-label={t('cap.rollback')} disabled={busy} onClick={() => setConfirmation({ kind: 'rollback' })}><IconRefreshOutline16 /></Button></span></Tooltip>}
              {(checkFailed || row.error && !row.updateAvailable) && <Button variant="outline" size="sm" disabled={busy}
                onClick={() => controller.command('check')}><IconRefreshOutline16 />{t('cap.retryCheck')}</Button>}
              {row.updateAvailable && !checkFailed && !row.pending && !active && !row.managerUpdateRequired && <>
                <Tooltip label={t(row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')} side="top"><span className={css.iconWrap}><Button variant="outline" size="sm" className={css.downloadButton}
                  aria-label={`${t(row.error ? 'cap.retry' : row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')} ${name(row)}`} disabled={!download}
                  onClick={() => setConfirmation({ kind: 'install', row })}><IconDownloadOutline16 />{t(row.error ? 'cap.retry' : row.kind === 'plugin' ? 'cap.download' : 'cap.agentDownload')}</Button></span></Tooltip>
                {!isSkipped && <Button variant="ghost" size="sm" className={css.skip} disabled={busy} onClick={() => controller.skip(row.id, row.latestVersion)}>{t('cap.skip')}</Button>}
              </>}
            </div>
          </div>
        </li>
      })}
    </ul></>}
  </div>
}

/** Settings navigation entry after Plugins; no separate update dialog. */
export function CapabilitiesSection({ useDesktop, controller, t }: Props) {
  const state = useDesktop(value => value)
  return <section className={css.section}><h2 className={css.heading}>{t('cap.title')}</h2><Content state={state} controller={controller} t={t} /></section>
}

/** New-version notifications navigate the Settings-owned page; no second dialog is mounted. */
export function CapabilitiesNotification({ useDesktop, controller, openSection }: Props & PropsRuntime<'settings.notification'>) {
  useEffect(() => { controller.reportViewReady() }, [controller])
  const open = useDesktop(value => value.open && !value.picker)
  useEffect(() => {
    if (!open) return
    openSection('capabilities')
    controller.close()
  }, [open, openSection, controller])
  return null
}
