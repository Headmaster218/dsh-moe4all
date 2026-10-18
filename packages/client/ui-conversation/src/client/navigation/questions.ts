/** On-demand user-message index. History reads never activate an Agent. */
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client'

/** A user-authored question in this session, including steering messages. */
export interface QuestionEntry { seq: number; text: string; time: number }

/** Fetch only when the directory is opened; do not mount the full transcript.
 * @param history - Session-authorized history reader.
 * @param signal - Directory lifetime/cancellation signal.
 * @returns All user questions in chronological order, without injected context.
 */
export async function readQuestions(
  history: (beforeSeq: number | undefined, signal: AbortSignal) => Promise<{ events: HistoryEntry[]; hasMore: boolean }>,
  signal: AbortSignal,
): Promise<QuestionEntry[]> {
  const questions = new Map<number, QuestionEntry>()
  let beforeSeq: number | undefined
  for (;;) {
    signal.throwIfAborted()
    const page = await history(beforeSeq, signal)
    signal.throwIfAborted()
    for (const { event } of page.events) {
      if (event.type !== 'user/message' || event.data.source.kind !== 'user' || !isAppendSurfaceEvent(event)) continue
      questions.set(event.seq, { seq: event.seq, time: event.time,
        text: event.data.content.filter(part => part.type === 'text').map(part => part.text).join('\n') })
    }
    if (!page.hasMore) break
    const next = page.events[0]?.event.seq
    if (next === undefined || beforeSeq !== undefined && next >= beforeSeq) throw new Error('History paging made no progress')
    beforeSeq = next
  }
  return [...questions.values()].sort((a, b) => a.seq - b.seq)
}

/** Materialize older pages only after a question is selected.
 * @param session - Existing session viewport, not a resumed model run.
 * @param seq - Selected user-message sequence.
 * @param signal - Navigation lifetime signal.
 * @returns When the target is available to the existing keyed chat renderer.
 */
export async function revealQuestion(session: SessionFace, seq: number, signal: AbortSignal): Promise<void> {
  for (;;) {
    signal.throwIfAborted()
    const snapshot = session.getSnapshot()
    if (snapshot.openState !== 'open') throw new Error('Conversation history is not ready; retry navigation')
    if (snapshot.chat.order.some(key => {
      const node = snapshot.chat.nodes.get(key)
      return (node?.kind === 'user' || node?.kind === 'steering') && node.anchorSeq === seq
    })) return
    if (snapshot.loadingOlder) {
      await new Promise<void>((resolve, reject) => {
        const stop = (): void => { unsubscribe(); signal.removeEventListener('abort', abort) }
        const abort = (): void => { stop(); reject(signal.reason) }
        const unsubscribe = session.subscribe(() => {
          if (!session.getSnapshot().loadingOlder) { stop(); resolve() }
        })
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
        else if (!session.getSnapshot().loadingOlder) { stop(); resolve() }
      })
      continue
    }
    if (!snapshot.hasMore) throw new Error('Question is not available in this session')
    const first = snapshot.chat.order[0]
    await session.loadOlder()
    signal.throwIfAborted()
    if (session.getSnapshot().chat.order[0] === first) throw new Error('Could not load earlier messages; retry navigation')
  }
}
