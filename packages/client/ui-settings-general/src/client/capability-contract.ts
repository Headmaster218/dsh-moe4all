/** JSON-only desktop update snapshot; the native owner validates all install commands again. */
export interface CapabilityRow {
  id: string
  kind: 'agent' | 'engine' | 'plugin'
  zh: string
  en: string
  installedVersion: string
  latestVersion: string
  phase: string
  error: string
  releaseUrl: string
  updateAvailable: boolean
  rollbackAvailable: boolean
  completed: number
  total: number
  pending: boolean
  managerUpdateRequired?: boolean
  externallyManaged?: boolean
  requiresStop?: boolean
  checkedAt?: number
  lastUpdate?: { from: string; to: string; at: number }
}

/** Validated subset of the process-owned persistent state. */
export interface CapabilitySnapshot {
  settings: { autoCheck: boolean; preview: boolean; skipped: Record<string, string> }
  plugins: CapabilityRow[]
  engine?: CapabilityRow
  checking: boolean
  pending: boolean
}

type JsonObject = Record<string, unknown>
const object = (value: unknown): JsonObject | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined
const text = (value: unknown): string => typeof value === 'string' ? value.slice(0, 2000) : ''
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

/** Parse the untrusted native message at the process boundary, without passing arbitrary objects into UI state. */
export function capabilitySnapshot(value: unknown): CapabilitySnapshot | undefined {
  const row = object(value)
  const settings = object(row?.settings)
  if (row?.schema !== 'moe4all/capabilities/v1' || typeof settings?.autoCheck !== 'boolean' || typeof settings.preview !== 'boolean'
    || !Array.isArray(row.plugins) || row.plugins.length > 32 || typeof row.pending !== 'boolean') return
  const plugins: CapabilityRow[] = []
  for (const item of row.plugins) {
    const plugin = object(item)
    const lastUpdate = object(plugin?.lastUpdate)
    if (!plugin || typeof plugin.id !== 'string' || !/^dsh-[a-z0-9-]{1,75}$/u.test(plugin.id)
      || typeof plugin.installedVersion !== 'string' || typeof plugin.latestVersion !== 'string' || typeof plugin.updateAvailable !== 'boolean') return
    plugins.push({ id: plugin.id, kind: 'plugin', zh: text(plugin.zh), en: text(plugin.en), installedVersion: plugin.installedVersion,
      latestVersion: plugin.latestVersion, phase: text(plugin.phase), error: text(plugin.error), releaseUrl: text(plugin.releaseUrl),
      updateAvailable: plugin.updateAvailable, rollbackAvailable: plugin.rollbackAvailable === true, completed: count(plugin.completed), total: count(plugin.total), pending: plugin.pending === true,
      checkedAt: count(plugin.checkedAt), ...(lastUpdate && typeof lastUpdate.from === 'string' && typeof lastUpdate.to === 'string' && count(lastUpdate.at) > 0
        ? { lastUpdate: { from: lastUpdate.from, to: lastUpdate.to, at: count(lastUpdate.at) } } : {}) })
  }
  const engine = object(row.engine), installed = object(engine?.installed), latest = object(engine?.latest), runtime = object(engine?.runtime), install = object(engine?.install)
  const skipped = Object.fromEntries(Object.entries(object(settings.skipped) ?? {}).filter(([key, entry]) => /^[a-z0-9-]{1,80}$/u.test(key) && typeof entry === 'string')) as Record<string, string>
  return { settings: { autoCheck: settings.autoCheck, preview: settings.preview, skipped }, plugins,
    checking: row.checking === true, pending: row.pending,
    ...(engine ? { engine: { id: 'engine', kind: 'engine' as const, zh: 'MoE4All 引擎', en: 'MoE4All Engine',
      installedVersion: text(installed?.tag), latestVersion: text(latest?.tag), phase: text(engine.phase), error: text(engine.error),
      updateAvailable: engine.canInstall === true && runtime?.owned !== true && !!latest && (engine.updateAvailable === true || !installed),
      rollbackAvailable: false, pending: false, releaseUrl: 'https://github.com/Headmaster218/MoE4All/releases',
      completed: count(install?.downloadedBytes), total: count(install?.totalBytes), managerUpdateRequired: engine.managerUpdateRequired === true,
      externallyManaged: runtime?.mode === 'connect' || (!!runtime?.executable && engine.managed !== true), requiresStop: runtime?.owned === true } } : {}) }
}
