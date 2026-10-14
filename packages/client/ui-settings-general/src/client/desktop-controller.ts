/** Page-scoped bridge to the desktop application updater; browser deployments omit it. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

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
}

type DesktopCommand = 'status' | 'check' | 'install' | 'release' | 'browser'
type DesktopBridge = {
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
    if (data.type !== 'moe4all-desktop-state' || !['idle', 'checking', 'available', 'current', 'download', 'verify', 'extract', 'install', 'error'].includes(String(data.phase))) return
    if (typeof data.installedVersion !== 'string' || typeof data.version !== 'string' || typeof data.message !== 'string'
      || typeof data.completed !== 'number' || !Number.isFinite(data.completed) || data.completed < 0
      || typeof data.total !== 'number' || !Number.isFinite(data.total) || data.total < 0 || typeof data.open !== 'boolean') return
    this.store.set({ phase: data.phase as DesktopPhase, installedVersion: data.installedVersion, version: data.version,
      completed: data.completed, total: data.total, message: data.message, open: data.open || this.store.getSnapshot().open })
  }

  /** @param bridge - WebView2 message interface belonging to this page. */
  constructor(private readonly bridge: DesktopBridge) {
    bridge.addEventListener('message', this.receive)
    this.send('status')
  }

  /** @param command - Fixed action; installation is requested only after a visible confirmation. */
  send(command: DesktopCommand): void {
    if (command === 'check') this.store.set({ ...this.store.getSnapshot(), phase: 'checking', open: true, message: '' })
    if (command === 'install') {
      if (this.store.getSnapshot().phase !== 'available') return
      this.store.set({ ...this.store.getSnapshot(), phase: 'download', open: true, completed: 0, message: '' })
    }
    this.bridge.postMessage({ type: 'moe4all-desktop-command', command })
  }

  /** Keep progress available in Settings when the modal is dismissed. */
  close(): void { this.store.set({ ...this.store.getSnapshot(), open: false }) }

  /** Reopen the latest result without starting another check. */
  open(): void { this.store.set({ ...this.store.getSnapshot(), open: true }) }

  /** Release the native event subscription on plugin unload. */
  dispose(): void { this.bridge.removeEventListener('message', this.receive) }
}
