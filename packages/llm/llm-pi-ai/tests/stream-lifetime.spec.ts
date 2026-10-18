import { afterEach, describe, expect, it, vi } from 'vitest'
import { idleWatchdog } from '@deepseek-ai/dsh-timeout'
import { closeStreamIterator, settleStreamOperation } from '../src/stream-lifetime.ts'

afterEach(() => { vi.useRealTimers() })
describe('uncooperative SDK stream', () => {
  it('reproduces the notification-only watchdog hang with an iterator ignoring abort', async () => {
    vi.useFakeTimers()
    using watchdog = idleWatchdog(undefined, 20, 'LLM_STREAM_IDLE_TIMEOUT')
    const next = Promise.withResolvers<IteratorResult<string>>()
    const iterator = { next: () => next.promise }
    let settled = false
    const blocked = watchdog.next(iterator).then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(30)
    expect(watchdog.signal.aborted).toBe(true)
    expect(settled).toBe(false)
    next.resolve({ done: true, value: undefined }); await blocked
  })
  it('releases both next and return when the SDK ignores idle cancellation', async () => {
    vi.useFakeTimers()
    using watchdog = idleWatchdog(undefined, 20, 'LLM_STREAM_IDLE_TIMEOUT')
    const pending = Promise.withResolvers<IteratorResult<string>>()
    const iterator = { next: () => pending.promise, return: () => pending.promise }
    const guarded = settleStreamOperation(watchdog.next(iterator), watchdog.signal)
    const refusal = expect(guarded).rejects.toMatchObject({ code: 'LLM_STREAM_IDLE_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(30)
    await refusal
    await closeStreamIterator(iterator, watchdog.signal)
    // A late SDK error is observed rather than becoming an unhandled rejection.
    pending.reject(new Error('late SDK failure'))
    await Promise.resolve()
  })
  it('preserves normal values, failures and awaited teardown', async () => {
    const controller = new AbortController()
    expect(await settleStreamOperation(Promise.resolve(4), controller.signal)).toBe(4)
    await expect(settleStreamOperation(Promise.reject(new Error('provider')), controller.signal)).rejects.toThrow('provider')
    const done = Promise.withResolvers<IteratorResult<string>>()
    let closed = false
    const cleanup = closeStreamIterator({ next: async () => ({ done: true, value: undefined }), return: () => done.promise }, controller.signal)
      .then(() => { closed = true })
    await Promise.resolve(); expect(closed).toBe(false)
    done.resolve({ done: true, value: undefined }); await cleanup
    expect(closed).toBe(true)
  })
  it('honors explicit caller abort without waiting for the idle timeout', async () => {
    const controller = new AbortController()
    const never = Promise.withResolvers<string>()
    const guarded = settleStreamOperation(never.promise, controller.signal)
    controller.abort(new Error('user stopped'))
    await expect(guarded).rejects.toThrow('user stopped')
  })
})
