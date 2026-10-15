// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { DesktopController, desktopBridge } from '../src/client/desktop-controller.ts'
import { CapabilitiesSection, CapabilitiesDialog } from '../src/client/Capabilities.tsx'
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
  const props = { controller, useDesktop: bindSnapshotSelector(controller.store), t }
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

it('uses a DSH in-page Modal and requires a second explicit download confirmation', () => {
  const f = fixture()
  render(<CapabilitiesDialog {...f.props} />)
  act(() => { f.send(f.agent); f.send(f.caps) })
  expect(screen.getByRole('dialog', { name: 'Capabilities' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Download and prepare Mneme Memory' }))
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  const confirmation = screen.getByRole('region', { name: 'Confirm update' })
  expect(within(confirmation).getByText('0.7.30-moe4all.1')).toBeDefined()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm download' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'prepare', id: 'dsh-mneme-moe4all', version: '0.7.30-moe4all.1', confirmed: true })
})

it('shows download progress, can dismiss it and reopen the same state without another download', () => {
  const f = fixture()
  render(<CapabilitiesDialog {...f.props} />)
  act(() => { f.send(f.agent); f.send(f.caps) })
  act(() => f.send({ ...f.agent, phase: 'download', completed: 50, open: false }))
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('50')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => f.controller.open())
  expect(screen.getByRole('progressbar')).toBeDefined()
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  act(() => { f.controller.close(); f.send({ ...f.agent, phase: 'error', message: 'Download interrupted', open: true }) })
  expect(screen.getByRole('dialog', { name: 'Capabilities' })).toBeDefined()
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

it('does not interrupt a check for repeated automatic popups and confirms restart separately', () => {
  const f = fixture()
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, checking: true } })
  expect(f.controller.store.getSnapshot().open).toBe(false)
  f.send({ ...f.caps, snapshot: { ...f.caps.snapshot, pending: true } })
  render(<CapabilitiesDialog {...f.props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Restart and apply' }))
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(2)
  const confirmation = screen.getByRole('region', { name: 'Confirm update' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Restart and apply' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-capabilities-command', command: 'restart', confirmed: true })
})
