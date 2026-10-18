/**
 * Per-session chat store shared by conversation and details registrations.
 * The plugin creates its handle at apply time so identity follows the fiber.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { CallId, ChatStoreState, SelectionTarget } from './contract/views.ts'

/** Declared action shape used to give the exported factory a stable return type. */
type ChatActions = {
  setDetailsMode: (draft: ChatStoreState, mode: NonNullable<ChatStoreState['detailsMode']>) => void
  openWorkbenchFile: (draft: ChatStoreState, path: string) => void
  closeWorkbenchFile: (draft: ChatStoreState, path: string) => void
  select: (draft: ChatStoreState, target: SelectionTarget | null) => void
  setDraft: (draft: ChatStoreState, text: string) => void
  setView: (draft: ChatStoreState, view: string) => void
  setInspect: (draft: ChatStoreState, target: { callId: CallId } | null) => void
  setQuestionTarget: (draft: ChatStoreState, seq: number | null) => void
}

/**
 * Declares the per-session chat state and write surface.
 * @returns the store handle.
 */
export function createChatStore(): EngineStoreHandle<ChatStoreState, ChatActions> {
  return defineStore({
    // Anchored to the contract shape: consumers read the store through
    // PropsStore<ChatStore>'s SnapshotSelectorHook<ChatStoreState>, so init
    // and the contract cannot drift.
    init: (): ChatStoreState => ({ selection: null, draft: '', view: null, inspect: null }),
    persist: 'dsh.conversation.chat',
    actions: {
      select: (d, target: SelectionTarget | null) => { d.selection = target; d.detailsMode = 'tool' },
      setDetailsMode: (d, mode: NonNullable<ChatStoreState['detailsMode']>) => { d.detailsMode = mode },
      openWorkbenchFile: (d, path: string) => {
        d.detailsMode = 'files'
        d.workbench ??= { paths: [], active: null }
        if (path === '.') { d.workbench.active = null; return }
        if (!d.workbench.paths.includes(path)) d.workbench.paths.push(path)
        d.workbench.active = path
      },
      closeWorkbenchFile: (d, path: string) => {
        if (d.workbench === undefined) return
        d.workbench.paths = d.workbench.paths.filter(item => item !== path)
        if (d.workbench.active === path) d.workbench.active = d.workbench.paths.at(-1) ?? null
      },
      setDraft: (d, text: string) => { d.draft = text },
      setView: (d, view: string) => { d.view = view },
      setInspect: (d, target: { callId: CallId } | null) => { d.inspect = target },
      setQuestionTarget: (d, seq: number | null) => { d.questionTarget = seq },
    },
  })
}
