// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { DesktopController, desktopBridge } from '../src/client/desktop-controller.ts'
import { DesktopSettingsRow, DesktopUpdateDialog } from '../src/client/DesktopSettingsRow.tsx'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'chrome') })

function fixture() {
  const bridge = { postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const controller = new DesktopController(bridge)
  const receive = bridge.addEventListener.mock.calls[0]![1] as (event: MessageEvent) => void
  const send = (data: object) => receive(new MessageEvent('message', { data }))
  const state = { type: 'moe4all-desktop-state', phase: 'available', installedVersion: 'preview.test', version: 'preview.next', completed: 0, total: 100, message: '', open: true }
  return { bridge, controller, receive, send, state }
}

it('omits desktop controls in browsers and owns its message listener', () => {
  expect(desktopBridge()).toBeUndefined()
  const f = fixture()
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-desktop-command', command: 'status' })
  f.controller.dispose()
  expect(f.bridge.removeEventListener).toHaveBeenCalledWith('message', f.receive)
})

it('rejects malformed native events and never installs merely on notification', () => {
  const f = fixture()
  for (const data of [null, {}, { ...f.state, phase: 'unknown' }, { ...f.state, total: NaN }, { ...f.state, completed: -1 }, { ...f.state, open: 'yes' }])
    f.receive(new MessageEvent('message', { data }))
  expect(f.controller.store.getSnapshot().phase).toBe('idle')
  f.controller.send('install')
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(1)
  f.send(f.state)
  expect(f.bridge.postMessage).toHaveBeenCalledTimes(1)
  f.controller.send('install')
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-desktop-command', command: 'install' })
  f.controller.close()
  f.send({ ...f.state, phase: 'download', completed: 50, open: false })
  expect(f.controller.store.getSnapshot().open).toBe(false)
  f.controller.open()
  expect(f.controller.store.getSnapshot().completed).toBe(50)
})

it('uses the shared dialog, requires an install click and restores dismissed progress', () => {
  const f = fixture()
  const t = (key: string) => (en as Record<string, string>)[key] ?? key
  const props = { controller: f.controller, useDesktop: bindSnapshotSelector(f.controller.store), t }
  render(<><DesktopSettingsRow {...props} /><DesktopUpdateDialog {...props} /></>)
  act(() => f.send(f.state))
  expect(screen.getByRole('dialog')).toBeDefined()
  expect(screen.getByText('preview.next')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Download and install' }))
  act(() => f.send({ ...f.state, phase: 'download', completed: 50, open: false }))
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('50')
  fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!)
  fireEvent.click(screen.getByRole('button', { name: 'View progress' }))
  expect(screen.getByRole('progressbar')).toBeDefined()
})
