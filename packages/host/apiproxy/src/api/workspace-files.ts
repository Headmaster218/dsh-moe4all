/** User-initiated workspace file operations; never tool or model execution. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The selected session supplies the root; clients cannot choose an arbitrary preview root. */
export type WorkspaceFileOperation =
  | { kind: 'list'; path: string }
  | { kind: 'read'; path: string }
  | { kind: 'upload'; name: string; dataBase64: string }
  | { kind: 'reference'; path: string }

/** Operation with its session-authored workspace root address. */
export type WorkspaceFileRequest = { sessionId: SessionId } & WorkspaceFileOperation

/** A workspace-relative child path, never followed outside the real workspace. */
export interface WorkspaceFileEntry { name: string; path: string; directory: boolean }

/** Bounded file operation results for the composer and workbench. */
export type WorkspaceFileReply =
  | { kind: 'directory'; path: string; entries: WorkspaceFileEntry[]; truncated: boolean }
  | { kind: 'file'; path: string; mime: string; size: number; dataBase64: string }
  | { kind: 'imported'; path: string }
