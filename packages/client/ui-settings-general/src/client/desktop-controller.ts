/** Page-scoped bridge to the desktop application updater; browser deployments omit it. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { capabilitySnapshot, type CapabilitySnapshot } from './capability-contract.ts'

/** Native update phases, with values validated before entering the UI store. */
export type DesktopPhase = 'idle' | 'checking' | 'available' | 'current' | 'download' | 'verify' | 'extract' | 'install' | 'error'

/** Native update state displayed by the Settings shell. */
export interface DesktopState {
  phase: DesktopPhase
  installedVersion: string
  version: string
  completed: number
  total: number
  message: string
  open: boolean
  capabilities?: CapabilitySnapshot
  capabilityBusy?: boolean
  capabilityError?: string
}

type DesktopCommand = 'status' | 'check' | 'install' | 'release' | 'browser'
export type DesktopBridge = {
  postMessage(value: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
}

/** Resolve the real WebView2 bridge; ordinary browsers expose no desktop actions. */
export function desktopBridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return
  return (window as Window & { chrome?: { webview?: DesktopBridge } }).chrome?.webview
}

/** Lifecycle owner for update notifications and explicitly requested native actions. */
export class DesktopController {
  readonly store = createSnapshotStore<DesktopState>({ phase: 'idle', installedVersion: '', version: '', completed: 0, total: 0, message: '', open: false })
  private readonly receive = (event: MessageEvent<unknown>): void => {
    const value = event.data
    if (typeof value !== 'object' || value === null) return
    const data = value as Record<string, unknown>
    if (data.type === 'moe4all-capabilities-state' && typeof data.busy === 'boolean') {
      const capabilities = capabilitySnapshot(data.snapshot)
      if (!capabilities) return
      this.store.set({ ...this.store.getSnapshot(), capabilities, capabilityBusy: data.busy })
      this.notifyUpdates()
      return
    }
    if (data.type === 'moe4all-capabilities-error' && typeof data.message === 'string') {
      this.store.set({ ...this.store.getSnapshot(), capabilityError: data.message.slice(0, 2000), open: true })
      return
    }
    if (data.type !== 'moe4all-desktop-state' || !['idle', 'checking', 'available', 'current', 'download', 'verify', 'extract', 'install', 'error'].includes(String(data.phase))) return
    if (typeof data.installedVersion !== 'string' || typeof data.version !== 'string' || typeof data.message !== 'string'
      || typeof data.completed !== 'number' || !Number.isFinite(data.completed) || data.completed < 0
      || typeof data.total !== 'number' || !Number.isFinite(data.total) || data.total < 0 || typeof data.open !== 'boolean') return
    this.store.set({ ...this.store.getSnapshot(), phase: data.phase as DesktopPhase, installedVersion: data.installedVersion, version: data.version,
      completed: data.completed, total: data.total, message: data.message, open: this.store.getSnapshot().open || (data.phase === 'error' && data.open) })
    this.notifyUpdates()
  }

  /** @param bridge - WebView2 message interface belonging to this page. */
  constructor(private readonly bridge: DesktopBridge) {
    bridge.addEventListener('message', this.receive)
    this.send('status')
    this.command('status')
  }

  private readonly notified = new Set<string>()

  private notifyUpdates(): void {
    const state = this.store.getSnapshot(), snapshot = state.capabilities
    if (!snapshot || snapshot.checking) return
    const updates = [...snapshot.plugins, ...(snapshot.engine ? [snapshot.engine] : [])]
      .filter(row => row.updateAvailable).map(row => [row.id, row.latestVersion])
    if (state.phase === 'available') updates.push(['agent', state.version])
    let open = state.open
    for (const [id, version] of updates) {
      const key = `${id}:${version}`
      if (snapshot.settings.skipped[id!] !== version && !this.notified.has(key)) { this.notified.add(key); open = true }
    }
    if (open !== state.open) this.store.set({ ...state, open })
  }

  /** Fixed native actions carry only JSON data; no arbitrary process or path command is exposed. */
  command(command: 'status' | 'check' | 'prepare' | 'engine-install' | 'engine-cancel' | 'rollback' | 'restart' | 'cancel' | 'settings' | 'skip',
    options: { id?: string; version?: string; confirmed?: boolean; autoCheck?: boolean; preview?: boolean } = {}): void {
    this.store.set({ ...this.store.getSnapshot(), capabilityError: '' })
    this.bridge.postMessage({ type: 'moe4all-capabilities-command', command, ...options })
  }

  /** Persist suppression for this exact component/version; manual checks and installation stay available. */
  skip(id: string, version: string): void {
    const state = this.store.getSnapshot(), capabilities = state.capabilities
    if (!capabilities) return
    this.notified.add(`${id}:${version}`)
    this.store.set({ ...state, capabilities: { ...capabilities, settings: { ...capabilities.settings, skipped: { ...capabilities.settings.skipped, [id]: version } } } })
    this.command('skip', { id, version })
  }

  /** @param command - Fixed action; installation is requested only after a visible confirmation. */
  send(command: DesktopCommand, version?: string): void {
    if (command === 'check') this.store.set({ ...this.store.getSnapshot(), phase: 'checking', open: true, message: '' })
    if (command === 'install') {
      if (this.store.getSnapshot().phase !== 'available' || (version !== undefined && this.store.getSnapshot().version !== version)) return
      version ??= this.store.getSnapshot().version
      this.store.set({ ...this.store.getSnapshot(), phase: 'download', open: true, completed: 0, message: '' })
    }
    this.bridge.postMessage({ type: 'moe4all-desktop-command', command, ...(command === 'install' ? { version } : {}) })
  }

  /** Keep progress available in Settings when the modal is dismissed. */
  close(): void { this.store.set({ ...this.store.getSnapshot(), open: false }) }

  /** Reopen the latest result without starting another check. */
  open(): void { this.store.set({ ...this.store.getSnapshot(), open: true }) }

  /** Release the native event subscription on plugin unload. */
  dispose(): void { this.bridge.removeEventListener('message', this.receive) }
}
