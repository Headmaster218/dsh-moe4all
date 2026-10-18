/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry } from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { sessionIdSchema } from './sessions.schema.ts'

/** Workspace file request; the payload cap precedes byte decoding. */
export const hostWorkspaceFilesRequestSchema = z.intersection(z.object({ sessionId: sessionIdSchema }), z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('list'), path: z.string() }),
  z.object({ kind: z.literal('read'), path: z.string().min(1) }),
  z.object({ kind: z.literal('upload'), name: z.string().min(1).max(240), dataBase64: z.string().max(44739244) }),
  z.object({ kind: z.literal('reference'), path: z.string().min(1) }),
])) satisfies z.ZodType<Wire<RequestPayload<'host.workspaceFiles'>>>

/** Bounded directory, preview and imported path wire results. */
export const hostWorkspaceFilesValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('directory'), path: z.string(), truncated: z.boolean(), entries: z.array(z.object({ name: z.string(), path: z.string(), directory: z.boolean() })) }),
  z.object({ kind: z.literal('file'), path: z.string(), mime: z.string(), size: z.number().nonnegative(), dataBase64: z.string() }),
  z.object({ kind: z.literal('imported'), path: z.string() }),
]) satisfies z.ZodType<Wire<ResponseValue<'host.workspaceFiles'>>>

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  home: z.string(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>
/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>
