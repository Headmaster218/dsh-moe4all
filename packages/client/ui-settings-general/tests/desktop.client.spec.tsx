// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { DesktopController, desktopBridge } from '../src/client/desktop-controller.ts'
import { CapabilitiesSection, CapabilitiesNotification } from '../src/client/Capabilities.tsx'
import { capabilitySnapshot } from '../src/client/capability-contract.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'chrome') })

function fixture() {
  const bridge = { postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const controller = new DesktopController(bridge)
  const receive = bridge.addEventListener.mock.calls[0]![1] as (event: MessageEvent) => void
  const send = (data: object) => receive(new MessageEvent('message', { data }))
  const agent = { type: 'moe4all-desktop-state', phase: 'available', installedVersion: 'release-0.1.0-preview.3', version: 'release-0.1.0-preview.4', completed: 0, total: 100, message: '', open: true }
  const plugin = { id: 'dsh-mneme-moe4all', kind: 'plugin', zh: 'Mneme 记忆', en: 'Mneme Memory', installedVersion: '0.7.29-moe4all.1', latestVersion: '0.7.30-moe4all.1', updateAvailable: true, phase: 'available' }
  const snapshot = { schema: 'moe4all/capabilities/v1', settings: { autoCheck: true, preview: true, skipped: {} }, plugins: [plugin], checking: false, pending: false }
  const caps = { type: 'moe4all-capabilities-state', busy: false, snapshot }
  const t = (key: string) => (en as Record<string, string>)[key] ?? key
  const unusedHook = (() => { throw new Error('unused by capability notifications') }) as never
  const props = { controller, useDesktop: bindSnapshotSelector(controller.store), t, openSection: vi.fn(),
    useSessions: unusedHook, useWorkspaces: unusedHook }
  return { bridge, controller, receive, send, agent, caps, props }
}

it('omits desktop controls in browsers and owns the native message listener', () => {
  expect(desktopBridge()).toBeUndefined()
  const f = fixture()
  expect(f.bridge.postMessage).toHaveBeenNthCalledWith(1, { type: 'moe4all-desktop-command', command: 'status' })
  expect(f.bridge.postMessage).toHaveBeenNthCalledWith(2, { type: 'moe4all-capabilities-command', command: 'status' })
  f.controller.dispose()
  expect(f.bridge.removeEventListener).toHaveBeenCalledWith('message', f.receive)
})

it('rejects malformed native snapshots and never installs on notification', () => {
  const f = fixture()
  for (const data of [null, {}, { ...f.agent, phase: 'unknown' }, { ...f.agent, total: NaN }, { ...f.agent, completed: -1 }, { ...f.agent, open: 'yes' }])
    f.receive(new MessageEvent('message', { data }))
  expect(f.controller.store.getSnapshot().phase).toBe('idle')
  expect(capabilitySnapshot({ ...f.caps.snapshot, plugins: [{ id: '../../escape' }] })).toBeUndefined()
  f.send(f.agent); f.send(f.caps)
  expect(f.controller.store.getSnapshot().open).toBe(true)
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
})

it('reports the committed view once, separately from bridge construction', () => {
  const f = fixture()
  expect(f.bridge.postMessage).not.toHaveBeenCalledWith({ type: 'moe4all-desktop-command', command: 'view-ready' })
  const view = render(<CapabilitiesNotification {...f.props} />)
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-desktop-command', command: 'view-ready' })
  view.unmount()
  render(<CapabilitiesNotification {...f.props} />)
  expect(f.bridge.postMessage.mock.calls.filter(([value]) => value.command === 'view-ready')).toHaveLength(1)
  f.controller.dispose()
})

it('uses the Settings section and requires a second explicit download confirmation', () => {
  const f = fixture()
  render(<CapabilitiesSection {...f.props} />)
  act(() => { f.send(f.agent); f.send(f.caps) })
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Download and prepare Mneme Memory' }))
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  const confirmation = screen.getByRole('region', { name: 'Confirm update' })
  expect(within(confirmation).getByText('0.7.30-moe4all.1')).toBeDefined()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm download' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'prepare', id: 'dsh-mneme-moe4all', version: '0.7.30-moe4all.1', confirmed: true })
})

it('shows download progress, can dismiss it and reopen the same state without another download', () => {
  const f = fixture()
  const view = render(<CapabilitiesSection {...f.props} />)
  act(() => { f.send(f.agent); f.send(f.caps) })
  act(() => f.send({ ...f.agent, phase: 'download', completed: 50, open: false }))
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('50')
  view.unmount()
  render(<CapabilitiesSection {...f.props} />)
  expect(screen.getByRole('progressbar')).toBeDefined()
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  act(() => { f.controller.close(); f.send({ ...f.agent, phase: 'error', message: 'Download interrupted', open: true }) })
  expect(screen.getByText('Download interrupted')).toBeDefined()
})

it('persists exact-version skips, suppresses repeated popup and notifies again for a newer version', () => {
  const f = fixture()
  f.send(f.caps)
  expect(f.controller.store.getSnapshot().open).toBe(true)
  f.controller.skip('dsh-mneme-moe4all', '0.7.30-moe4all.1'); f.controller.close()
  const skipped = { ...f.caps, snapshot: { ...f.caps.snapshot, settings: { ...f.caps.snapshot.settings, skipped: { 'dsh-mneme-moe4all': '0.7.30-moe4all.1' } } } }
  f.send(skipped)
  expect(f.controller.store.getSnapshot().open).toBe(false)
  const next = fixture(); next.send(skipped)
  expect(next.controller.store.getSnapshot().open).toBe(false)
  next.send({ ...skipped, snapshot: { ...skipped.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], latestVersion: '0.7.31-moe4all.1' }] } })
  expect(next.controller.store.getSnapshot().open).toBe(true)
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'skip', id: 'dsh-mneme-moe4all', version: '0.7.30-moe4all.1' })
})

it('keeps a skipped version manually installable from the Settings section', () => {
  const f = fixture(); f.send(f.caps); f.controller.skip('dsh-mneme-moe4all', '0.7.30-moe4all.1'); f.controller.close()
  render(<CapabilitiesSection {...f.props} />)
  expect(screen.getByText('Version skipped')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Download and prepare Mneme Memory' }))
  expect(screen.getByRole('region', { name: 'Confirm update' })).toBeDefined()
})

it('keeps introductions, recovery actions and restart instructions on their component cards', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], pending: true, phase: 'ready' }], pending: true } })
  render(<CapabilitiesSection {...f.props} />)
  const card = screen.getByRole('listitem', { name: 'Mneme Memory' })
  expect(within(card).getByText(en['cap.mnemeInfo'])).toBeDefined()
  expect(within(card).getByText(en['cap.preparedInfo'])).toBeDefined()
  expect(within(card).getByRole('button', { name: 'Restart and apply' })).toBeDefined()
  expect(within(card).queryByRole('button', { name: 'Download and prepare Mneme Memory' })).toBeNull()
  act(() => f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], phase: 'error', error: 'Network unavailable' }] } }))
  expect(within(card).getByText(en['cap.failedInfo'])).toBeDefined()
  expect(within(card).getByText(en['cap.details'])).toBeDefined()
  expect(within(card).getByRole('button', { name: 'Retry update Mneme Memory' })).toBeDefined()
  act(() => f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], updateAvailable: false, phase: 'complete' }] } }))
  expect(within(card).getByText(en['cap.current'])).toBeDefined()
  expect(within(card).queryByText(en['cap.complete'])).toBeNull()
})

it('explains the Engine Manager prerequisite without presenting it as an Engine installation failure', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, engine: { supported: true, managerUpdateRequired: true, phase: 'idle', error: '', latest: { tag: 'release-1.0.1' } } } })
  render(<CapabilitiesSection {...f.props} />)
  const card = screen.getByRole('listitem', { name: 'MoE4All Engine' })
  expect(within(card).getByText(en['cap.managerRequired'])).toBeDefined()
  expect(within(card).queryByText('Error details')).toBeNull()
  expect(within(card).queryByRole('button')).toBeNull()
})

it('does not notify subscribers again for identical capability status echoes', () => {
  const f = fixture()
  f.send(f.caps)
  const before = f.controller.store.getSnapshot()
  f.send(structuredClone(f.caps))
  expect(f.controller.store.getSnapshot()).toBe(before)
})

it('does not reopen for stored completion, errors, or a prepared operation', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], phase: 'prepare' }] } })
  f.controller.close()
  const ready = { ...f.caps, snapshot: { ...f.caps.snapshot, pending: true, plugins: [{ ...f.caps.snapshot.plugins[0], phase: 'ready', pending: true }] } }
  f.send(ready)
  expect(f.controller.store.getSnapshot().open).toBe(false)
  f.controller.close()
  f.send(structuredClone(ready))
  expect(f.controller.store.getSnapshot().open).toBe(false)
  for (const phase of ['complete', 'error', 'rolled-back']) {
    const next = fixture()
    next.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], updateAvailable: false, phase }] } })
    expect(next.controller.store.getSnapshot().open).toBe(false)
  }
})

it('navigates new-version notices into Settings without mounting another modal', () => {
  const f = fixture()
  render(<CapabilitiesNotification {...f.props} />)
  act(() => f.send(f.caps))
  expect(f.props.openSection).toHaveBeenCalledWith('capabilities')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(f.controller.store.getSnapshot().open).toBe(false)
  act(() => f.send(structuredClone(f.caps)))
  expect(f.props.openSection).toHaveBeenCalledTimes(1)
})

it('does not treat a first Engine installation as a new-version notification', () => {
  const f = fixture()
  const snapshot = { ...f.caps.snapshot, plugins: [], engine: { canInstall: true, latest: { tag: 'release-1.0.2' }, runtime: { mode: 'prompt', owned: false } } }
  f.send({ ...f.caps, snapshot })
  expect(f.controller.store.getSnapshot().capabilities?.engine?.updateAvailable).toBe(true)
  expect(f.controller.store.getSnapshot().open).toBe(false)
  f.send({ ...f.caps, snapshot: { ...snapshot, engine: { ...snapshot.engine, installed: { tag: 'release-1.0.1' }, updateAvailable: true } } })
  expect(f.controller.store.getSnapshot().open).toBe(true)
})

it('does not interrupt a check for repeated automatic popups and confirms restart separately', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, checking: true } })
  expect(f.controller.store.getSnapshot().open).toBe(false)
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, pending: true } })
  render(<CapabilitiesSection {...f.props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Restart and apply' }))
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  const confirmation = screen.getByRole('region', { name: 'Confirm update' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Restart and apply' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'restart', confirmed: true })
})

it('filters actionable components without mixing skipped versions with update history', () => {
  const f = fixture()
  const lastUpdate = { from: '0.7.28-moe4all.1', to: '0.7.29-moe4all.1', at: 1792100000000 }
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, settings: { ...f.caps.snapshot.settings, preview: false },
    plugins: [{ ...f.caps.snapshot.plugins[0], lastUpdate }] } })
  render(<CapabilitiesSection {...f.props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Needs attention 1' }))
  expect(screen.getByRole('listitem', { name: 'Mneme Memory' })).toBeDefined()
  expect(screen.queryByRole('listitem', { name: 'MoE4All Agent' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Skip this version' }))
  expect(screen.getByText(en['cap.noAttention'])).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Update history 1' }))
  expect(screen.getByText('0.7.28-moe4all.1 → 0.7.29-moe4all.1')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Download and prepare Mneme Memory' })).toBeNull()
})

it('distinguishes a failed metadata check from an unapplied plugin update', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, plugins: [{ ...f.caps.snapshot.plugins[0], errorStage: 'check', phase: 'error', error: 'HTTP 503' }] } })
  render(<CapabilitiesSection {...f.props} />)
  const card = screen.getByRole('listitem', { name: 'Mneme Memory' })
  expect(within(card).getByText(en['cap.checkFailedInfo'])).toBeDefined()
  expect(within(card).queryByText(en['cap.failedInfo'])).toBeNull()
  fireEvent.click(within(card).getByRole('button', { name: 'Check again' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'check' })
})

it('shows the prepared rollback target instead of implying the latest release will be installed', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, pending: true,
    plugins: [{ ...f.caps.snapshot.plugins[0], phase: 'ready', pending: true, pendingAction: 'rollback', preparedVersion: '0.7.28-moe4all.1' }] } })
  render(<CapabilitiesSection {...f.props} />)
  const card = screen.getByRole('listitem', { name: 'Mneme Memory' })
  expect(within(card).getByText('0.7.28-moe4all.1')).toBeDefined()
  expect(within(card).queryByText('0.7.30-moe4all.1')).toBeNull()
  expect(within(card).getByText(en['cap.rollbackReadyInfo'])).toBeDefined()
  expect(within(card).getByRole('list', { name: 'Update stages' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Update history 0' }))
  expect(screen.getByRole('button', { name: 'Restart and apply' })).toBeDefined()
})

it('allows an explicit retry of the same failed Agent update and never accepts an empty target', () => {
  const f = fixture()
  f.send({ ...f.agent, phase: 'error', message: 'Connection interrupted' }); f.send(f.caps)
  render(<CapabilitiesSection {...f.props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry update MoE4All Agent' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm download' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-desktop-command', command: 'install', version: f.agent.version })
  f.send({ ...f.agent, phase: 'error', version: '' })
  const count = f.bridge.postMessage.mock.calls.length
  f.controller.send('install')
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(count)
})

it('keeps a managed Engine update visible but requires stopping it before confirming installation', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, engine: { canInstall: true, managed: true, updateAvailable: true,
    installed: { tag: 'release-1.0.0' }, latest: { tag: 'release-1.0.1' }, runtime: { owned: true } } } })
  render(<CapabilitiesSection {...f.props} />)
  const card = screen.getByRole('listitem', { name: 'MoE4All Engine' })
  expect(within(card).getByText(en['cap.stopEngine'])).toBeDefined()
  expect(within(card).getByRole<HTMLButtonElement>('button', { name: 'Download and install MoE4All Engine' }).disabled).toBe(true)
})
