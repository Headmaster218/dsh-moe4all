/** Applied tool diffs, grouped by logged turn rather than inferred from prose. */
import type { ChatSnapshot, ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { DiffHunk } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatNode } from '../contract/chat-nodes.ts'

/** One settled successful mutation's applied hunks. */
export interface AppliedChange { turn: number; seq: number; callId: string; diffs: DiffHunk[] }

/** Read on a user gesture, not on every streamed token.
 * @param chat - Current loaded chat snapshot, including nested tool calls.
 * @returns Successful applied mutations in chronological order.
 */
export function appliedChanges(chat: ChatSnapshot): AppliedChange[] {
  const changes: AppliedChange[] = []
  const visit = (block: ToolCallBlock, turn: number): void => {
    if ('kind' in block && !block.isError && block.resultView?.card === 'diff') {
      changes.push({ turn, seq: block.seq, callId: block.callId, diffs: block.resultView.diffs })
    }
    for (const child of block.subCalls) visit(child, turn)
  }
  for (const node of chat.nodes.values()) {
    if (node.kind !== 'tool-call' || node.location.kind !== 'step' && node.location.kind !== 'turn') continue
    visit((node as ChatNode<'tool-call'>).data.root, node.location.turn.turn)
  }
  return changes.sort((a, b) => a.seq - b.seq)
}
