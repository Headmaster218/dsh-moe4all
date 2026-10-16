// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { DesktopController } from '../src/client/desktop-controller.ts'
import { DesktopPicker } from '../src/client/DesktopPicker.tsx'
import { pickerSnapshot } from '../src/client/picker-contract.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

function fixture() {
  const bridge = { postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const controller = new DesktopController(bridge)
  const receive = bridge.addEventListener.mock.calls[0]![1] as (event: MessageEvent) => void
  const picker = { id: 'a'.repeat(32), kind: 'model', path: 'D:\\Models', parent: 'D:\\', roots: ['D:\\', 'G:\\'],
    loading: false, truncated: false, error: '', entries: [{ name: 'model.gguf', path: 'D:\\Models\\model.gguf', directory: false },
      { name: 'folder', path: 'D:\\Models\\folder', directory: true }] }
  const send = (value: unknown) => receive(new MessageEvent('message', { data: { type: 'moe4all-picker-state', picker: value } }))
  const props = { controller, useDesktop: bindSnapshotSelector(controller.store), t: (key: string) => (en as Record<string, string>)[key] ?? key }
  return { bridge, controller, picker, send, props }
}

it('uses the shared modal with navigation, typed path and explicit selection', () => {
  const f = fixture(); f.send(f.picker)
  render(<DesktopPicker {...f.props} />)
  expect(screen.getByRole('dialog', { name: 'Select GGUF model' })).toBeDefined()
  expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'model.gguf' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-picker-command', command: 'select', id: f.picker.id, path: 'D:\\Models\\model.gguf' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Directory path' }), { target: { value: 'G:\\Models' } })
  fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-picker-command', command: 'list', id: f.picker.id, path: 'G:\\Models' })
})

it('keeps cancellation available while loading, clears stale selection and follows the locale', () => {
  const f = fixture(); f.send(f.picker)
  render(<DesktopPicker {...f.props} t={key => (zh as Record<string, string>)[key] ?? key} />)
  fireEvent.click(screen.getByRole('button', { name: 'model.gguf' }))
  act(() => f.send({ ...f.picker, path: 'G:\\', entries: [], loading: true }))
  expect(screen.getByText(zh['picker.loading'])).toBeDefined()
  expect((screen.getByRole('button', { name: '选择' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getAllByRole('button', { name: '取消' }).at(-1)!)
  expect(f.bridge.postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-picker-command', command: 'cancel', id: f.picker.id, path: '' })
  act(() => f.send(null))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('rejects malformed lists and sorts directories before files', () => {
  const f = fixture()
  expect(pickerSnapshot({ ...f.picker, id: 'bad' })).toBeUndefined()
  expect(pickerSnapshot({ ...f.picker, roots: [3] })).toBeUndefined()
  expect(pickerSnapshot({ ...f.picker, entries: Array(1001).fill(f.picker.entries[0]) })).toBeUndefined()
  expect(pickerSnapshot(f.picker)?.entries[0]?.directory).toBe(true)
})
