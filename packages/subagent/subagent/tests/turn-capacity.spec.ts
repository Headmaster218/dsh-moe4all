import { describe, expect, it } from 'vitest'
import { TurnCapacityGate } from '../src/turn-capacity.ts'

describe('TurnCapacityGate', () => {
  it('validates a positive safe capacity', () => {
    expect(() => new TurnCapacityGate(0)).toThrow('positive safe integer')
    expect(() => new TurnCapacityGate(Number.MAX_SAFE_INTEGER + 1)).toThrow('positive safe integer')
  })

  it('admits up to the limit and releases queued work in FIFO order', async () => {
    const gate = new TurnCapacityGate(1)
    const signal = new AbortController().signal
    const firstRelease = await gate.acquire(signal)
    const order: number[] = []
    const second = gate.acquire(signal).then((release) => {
      order.push(2)
      return release
    })
    const third = gate.acquire(signal).then((release) => {
      order.push(3)
      return release
    })

    expect(gate.snapshot()).toEqual({ active: 1, waiting: 2, limit: 1 })
    firstRelease()
    const secondRelease = await second
    expect(order).toEqual([2])
    secondRelease()
    const thirdRelease = await third
    expect(order).toEqual([2, 3])
    thirdRelease()
    expect(gate.snapshot()).toEqual({ active: 0, waiting: 0, limit: 1 })
  })

  it('reports per-owner active and queued states and clears them on release', async () => {
    const gate = new TurnCapacityGate(1)
    const firstRelease = await gate.acquire(new AbortController().signal, 'first')
    const pending = gate.acquire(new AbortController().signal, 'second')

    expect(gate.stateOf('first')).toBe('active')
    expect(gate.stateOf('second')).toBe('queued')
    firstRelease()
    const secondRelease = await pending
    expect(gate.stateOf('first')).toBeUndefined()
    expect(gate.stateOf('second')).toBe('active')
    secondRelease()
    expect(gate.stateOf('second')).toBeUndefined()
  })

  it('rotates queued work across groups while preserving each group FIFO', async () => {
    const gate = new TurnCapacityGate(1)
    const firstRelease = await gate.acquire(new AbortController().signal, 'active', 'active-parent')
    const order: string[] = []
    const queue = (ownerId: string, groupId: string) => gate.acquire(
      new AbortController().signal,
      ownerId,
      groupId,
    ).then((release) => {
      order.push(ownerId)
      return release
    })
    const firstA = queue('a1', 'parent-a')
    const secondA = queue('a2', 'parent-a')
    const firstB = queue('b1', 'parent-b')

    firstRelease()
    const releaseA1 = await firstA
    releaseA1()
    const releaseB1 = await firstB
    releaseB1()
    const releaseA2 = await secondA
    releaseA2()

    expect(order).toEqual(['a1', 'b1', 'a2'])
    expect(gate.snapshot()).toEqual({ active: 0, waiting: 0, limit: 1 })
  })

  it('removes an aborted waiter without consuming capacity or blocking later work', async () => {
    const gate = new TurnCapacityGate(1)
    const ownerRelease = await gate.acquire(new AbortController().signal)
    const aborted = new AbortController()
    const pending = gate.acquire(aborted.signal)
    const accepted = gate.acquire(new AbortController().signal)
    aborted.abort(new Error('cancel queued turn'))

    await expect(pending).rejects.toThrow('cancel queued turn')
    expect(gate.stateOf('second')).toBeUndefined()
    expect(gate.snapshot()).toEqual({ active: 1, waiting: 1, limit: 1 })
    ownerRelease()
    const acceptedRelease = await accepted
    expect(gate.snapshot()).toEqual({ active: 1, waiting: 0, limit: 1 })
    acceptedRelease()
    expect(gate.snapshot()).toEqual({ active: 0, waiting: 0, limit: 1 })
  })

  it('releases each permit only once', async () => {
    const gate = new TurnCapacityGate(1)
    const release = await gate.acquire(new AbortController().signal)
    release()
    release()
    expect(gate.snapshot()).toEqual({ active: 0, waiting: 0, limit: 1 })
  })
})
