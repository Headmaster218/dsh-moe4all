/** Non-recursive directory discovery through the existing filesystem provider. */

import type { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { sessionResolveOptions } from './session-cwd.ts'

interface DirectoryPage {
  path: string
  offset: number
  entries: { name: string; type: 'file' | 'directory' | 'other' }[]
  totalEntries: number
  nextOffset?: number
}

/**
 * Register shallow, paged directory discovery without recursive globbing.
 * @param ctx - context supplying the existing tools, prompt and filesystem services.
 * @param caps - deployment limits on entries and serialized result bytes.
 */
export function applyListDirectoryTool(ctx: Context, caps: { limit: number; maxBytes: number }): void {
  ctx.systemPrompt.section({
    name: 'tool:list_directory',
    order: 99,
    text: 'For a workspace overview, start with list_directory to see direct children, then read relevant project files and search selected subdirectories. Do not start an overview with a recursive glob of the entire workspace. A directory listing does not read file contents or authorize overwriting files.',
  })
  ctx.tools.register(defineTool({
    name: 'list_directory',
    description: 'List one directory without recursion or reading file contents. Use this first to inspect workspace structure.',
    parameters: {
      path: { type: 'string', description: 'Directory path relative to the session workspace. Defaults to ".".' },
      offset: { type: 'integer', description: 'Zero-based entry offset. Copy nextOffset to request another page.' },
      limit: { type: 'integer', description: `Maximum entries, default and cap ${caps.limit}.` },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          offset: { type: 'integer', required: true },
          entries: { type: 'array', required: true, items: {
            type: 'object', additionalProperties: false, properties: {
              name: { type: 'string', required: true },
              type: { type: 'string', enum: ['file', 'directory', 'other'], required: true },
            },
          } },
          totalEntries: { type: 'integer', required: true },
          nextOffset: { type: 'integer' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec): Promise<DirectoryPage> {
      const requestedPath = args.path ?? '.'
      const offset = args.offset ?? 0
      const limit = args.limit ?? caps.limit
      if (requestedPath.trim() === '') throw new Error('path must be a non-empty string')
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset must be a non-negative safe integer')
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > caps.limit) throw new Error(`limit must be between 1 and ${caps.limit}`)
      exec.signal.throwIfAborted()
      const target = await ctx.fs.resolve(requestedPath, sessionResolveOptions(exec, requestedPath))
      const children = await ctx.fs.listDir(target, exec.signal)
      exec.signal.throwIfAborted()
      const page: DirectoryPage = { path: target.displayPath, offset, entries: [], totalEntries: children.length }
      const encode = (): string => JSON.stringify(page, null, 2)
      if (Buffer.byteLength(encode()) > caps.maxBytes) throw new FsError('Directory metadata exceeds listMaxBytes', 'FS_TOO_LARGE')
      for (const child of children.slice(offset, offset + limit)) {
        page.entries.push({ name: child.name, type: child.type })
        const nextOffset = offset + page.entries.length
        if (nextOffset < children.length) page.nextOffset = nextOffset
        else delete page.nextOffset
        if (Buffer.byteLength(encode()) > caps.maxBytes) {
          page.entries.pop()
          if (page.entries.length === 0) throw new FsError('One directory entry exceeds listMaxBytes', 'FS_TOO_LARGE')
          page.nextOffset = offset + page.entries.length
          break
        }
      }
      return page
    },
    presentCall: args => ({ card: 'generic', title: `List directory ${args.path ?? '.'}`, kind: 'read' }),
  }))
}
