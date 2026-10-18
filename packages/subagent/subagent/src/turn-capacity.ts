interface TurnCapacityWaiter {
  readonly signal: AbortSignal
  readonly ownerId: string | undefined
  readonly groupId: string
  readonly resolve: (release: () => void) => void
  readonly reject: (error: unknown) => void
  readonly onAbort: () => void
}

/** Abort-aware capacity gate with round-robin fairness across groups and FIFO within each group. */
export class TurnCapacityGate {
  private active = 0
  private waiting = 0
  private sequence = 0
  private readonly groupOrder: string[] = []
  private readonly waitersByGroup = new Map<string, TurnCapacityWaiter[]>()
  private readonly ownerStates = new Map<string, 'active' | 'queued'>()

  constructor(readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error(`maxConcurrentContinuableTurns must be a positive safe integer, got ${limit}`)
    }
  }

  acquire(signal: AbortSignal, ownerId?: string, groupId?: string): Promise<() => void> {
    signal.throwIfAborted()
    if (this.active < this.limit && this.waiting === 0) {
      this.active += 1
      if (ownerId !== undefined) this.ownerStates.set(ownerId, 'active')
      return Promise.resolve(this.releaseHandle(ownerId))
    }
    return new Promise((resolve, reject) => {
      const queueGroup = groupId ?? `unowned:${this.sequence++}`
      const waiter: TurnCapacityWaiter = {
        signal,
        ownerId,
        groupId: queueGroup,
        resolve,
        reject,
        onAbort: () => {
          const queue = this.waitersByGroup.get(queueGroup)
          const index = queue?.indexOf(waiter) ?? -1
          if (index < 0) return
          queue?.splice(index, 1)
          this.waiting -= 1
          if (queue?.length === 0) {
            this.waitersByGroup.delete(queueGroup)
            const groupIndex = this.groupOrder.indexOf(queueGroup)
            if (groupIndex >= 0) this.groupOrder.splice(groupIndex, 1)
          }
          if (ownerId !== undefined) this.ownerStates.delete(ownerId)
          signal.removeEventListener('abort', waiter.onAbort)
          reject(signal.reason)
          this.drain()
        },
      }
      const queue = this.waitersByGroup.get(queueGroup)
      if (queue === undefined) {
        this.waitersByGroup.set(queueGroup, [waiter])
        this.groupOrder.push(queueGroup)
      } else {
        queue.push(waiter)
      }
      this.waiting += 1
      if (ownerId !== undefined) this.ownerStates.set(ownerId, 'queued')
      signal.addEventListener('abort', waiter.onAbort, { once: true })
      if (signal.aborted) waiter.onAbort()
    })
  }

  get activeCount(): number {
    return this.active
  }

  get waitingCount(): number {
    return this.waiting
  }

  snapshot(): { active: number; waiting: number; limit: number } {
    return { active: this.active, waiting: this.waiting, limit: this.limit }
  }

  stateOf(ownerId: string): 'active' | 'queued' | undefined {
    return this.ownerStates.get(ownerId)
  }

  private releaseHandle(ownerId?: string): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      this.active -= 1
      if (ownerId !== undefined) this.ownerStates.delete(ownerId)
      this.drain()
    }
  }

  private drain(): void {
    while (this.active < this.limit && this.waiting > 0) {
      const groupId = this.groupOrder.shift()
      if (groupId === undefined) return
      const queue = this.waitersByGroup.get(groupId)
      const waiter = queue?.shift()
      if (waiter === undefined || queue === undefined) continue
      this.waiting -= 1
      if (queue.length === 0) this.waitersByGroup.delete(groupId)
      else this.groupOrder.push(groupId)
      waiter.signal.removeEventListener('abort', waiter.onAbort)
      if (waiter.signal.aborted) {
        if (waiter.ownerId !== undefined) this.ownerStates.delete(waiter.ownerId)
        waiter.reject(waiter.signal.reason)
        continue
      }
      this.active += 1
      if (waiter.ownerId !== undefined) this.ownerStates.set(waiter.ownerId, 'active')
      waiter.resolve(this.releaseHandle(waiter.ownerId))
    }
  }
}
