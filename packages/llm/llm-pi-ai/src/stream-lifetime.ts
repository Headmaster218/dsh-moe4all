/** Cancellation guard for SDK streams that may ignore their AbortSignal. */

/** Await an SDK operation without making cancellation depend on its cooperation.
 * @param pending - The SDK operation, whose late rejection remains observed.
 * @param signal - Caller cancellation or idle watchdog deadline.
 * @returns The operation's value, or rejects with the winning abort reason.
 */
export async function settleStreamOperation<T>(pending: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  const observed = Promise.resolve(pending)
  // Observe a rejection even when the signal was already aborted at entry.
  if (signal.aborted) { void observed.catch(() => {}); throw signal.reason }
  let rejectAbort: (reason: unknown) => void = () => {}
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const onAbort = (): void => { rejectAbort(signal.reason) }
  signal.addEventListener('abort', onAbort, { once: true })
  try { return await Promise.race([observed, aborted]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

/** Close normally with quiescence, but do not re-block a cancelled request on a stalled SDK return.
 * @param iterator - Adapter translation iterator.
 * @param signal - The request's stable lifetime signal.
 * @returns When cleanup completed or cancellation released the caller.
 */
export async function closeStreamIterator<T>(iterator: AsyncIterator<T>, signal: AbortSignal): Promise<void> {
  if (iterator.return === undefined) return
  try { await settleStreamOperation(iterator.return(), signal) }
  catch (error: unknown) { if (!signal.aborted) throw error }
}
