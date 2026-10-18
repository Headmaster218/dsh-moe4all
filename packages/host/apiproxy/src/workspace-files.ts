/** Bounded, workspace-contained file reads and explicit user imports. */
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, realpath, readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { WorkspaceFileReply, WorkspaceFileRequest } from './api/workspace-files.ts'

/** Deployment-controlled limits shared by the file API and its UI. */
export interface WorkspaceFileLimits { maxBytes: number; maxEntries: number }

/** Default preview/upload and directory bounds, overridable by the gateway deployment. */
export const DEFAULT_WORKSPACE_FILE_LIMITS: WorkspaceFileLimits = { maxBytes: 32 * 1024 * 1024, maxEntries: 5000 }

/** Resolve a file within the real workspace, rejecting traversal and linked escapes.
 * @param root - Canonical workspace directory.
 * @param path - User-selected relative or absolute path.
 * @returns Canonical in-workspace path.
 */
export async function containedWorkspacePath(root: string, path: string): Promise<string> {
  const target = await realpath(resolve(root, path))
  const rel = relative(root, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || rel.split(sep).includes('.git')) {
    throw new Error('Path is outside the workspace or belongs to Git metadata')
  }
  return target
}

/** Strict basename checks also reject Windows alternate streams and reserved device names.
 * @param name - Browser-supplied upload basename.
 * @returns Whether it is a portable ordinary filename.
 */
export function validUploadName(name: string): boolean {
  return name.length > 0 && name.length <= 240 && name !== '.' && name !== '..'
    && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
}

/** Local preview MIME whitelist; unknown formats remain downloadable/openable outside the preview. */
function mimeOf(path: string): string {
  const extension = extname(path).toLowerCase()
  const types: Record<string, string> = {
    '.html': 'text/html', '.htm': 'text/html', '.md': 'text/markdown', '.markdown': 'text/markdown',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  if (types[extension] !== undefined) return types[extension]
  return /\.(txt|log|json|yaml|yml|toml|csv|ts|tsx|js|jsx|mjs|cjs|py|rs|css|xml|sh|ps1|c|cpp|h|sql)$/i.test(path)
    ? 'text/plain' : 'application/octet-stream'
}

/** Execute one file gesture without activating a model or overwriting existing files.
 * @param cwd - Session-authored workspace root, not a browser-supplied root.
 * @param request - Validated wire request.
 * @param limits - Deployment file and directory bounds.
 * @param signal - Request lifetime.
 * @returns A directory listing, preview bytes, or imported/reference path.
 */
export async function workspaceFiles(cwd: string, request: WorkspaceFileRequest, limits: WorkspaceFileLimits, signal: AbortSignal): Promise<WorkspaceFileReply> {
  signal.throwIfAborted()
  const root = await realpath(cwd)
  if (request.kind === 'reference') {
    // Explicit references may name external files. This checks existence only;
    // it does not extend the workbench's read roots or the model's permissions.
    const path = await realpath(resolve(root, request.path))
    if (!(await stat(path)).isFile()) throw new Error('Reference must name a file')
    signal.throwIfAborted()
    return { kind: 'imported', path }
  }
  if (request.kind === 'upload') {
    if (!validUploadName(request.name)) throw new Error('Invalid upload filename')
    const encoded = request.dataBase64
    if (encoded.length > Math.ceil(limits.maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new Error('Upload exceeds the file limit or is not canonical base64')
    }
    const data = Buffer.from(encoded, 'base64')
    if (data.byteLength > limits.maxBytes) throw new Error('Upload exceeds the file limit')
    const parent = join(root, '.moe4all-uploads')
    await mkdir(parent, { recursive: true })
    await containedWorkspacePath(root, parent)
    const directory = join(parent, randomUUID())
    await mkdir(directory)
    await containedWorkspacePath(root, directory)
    signal.throwIfAborted()
    const path = join(directory, request.name)
    const handle = await open(path, 'wx', 0o600)
    try { await handle.writeFile(data, { signal }) } finally { await handle.close() }
    return { kind: 'imported', path }
  }
  const path = await containedWorkspacePath(root, request.path)
  signal.throwIfAborted()
  if (request.kind === 'list') {
    const entries = []
    const children = await readdir(path, { withFileTypes: true })
    children.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    let truncated = false
    for (const child of children) {
      if (child.name === '.git') continue
      if (entries.length >= limits.maxEntries) { truncated = true; break }
      signal.throwIfAborted()
      // Links stay out of the tree: imports can still explicitly reference them.
      if (child.isSymbolicLink() || !child.isDirectory() && !child.isFile()) continue
      entries.push({ name: child.name, path: relative(root, join(path, child.name)), directory: child.isDirectory() })
    }
    return { kind: 'directory', path: relative(root, path), entries, truncated }
  }
  // O_NOFOLLOW protects the final file on platforms supporting it. Realpath
  // containment above also handles Windows junction and symlink escapes.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > limits.maxBytes) throw new Error('Preview requires a regular file within the file-size limit')
    const data = Buffer.alloc(Math.min(info.size + 1, limits.maxBytes + 1))
    let bytesRead = 0
    for (;;) {
      const next = await handle.read(data, bytesRead, data.length - bytesRead, bytesRead)
      bytesRead += next.bytesRead
      signal.throwIfAborted()
      if (next.bytesRead === 0 || bytesRead === data.length) break
    }
    signal.throwIfAborted()
    if (bytesRead > limits.maxBytes) throw new Error('File grew beyond the preview limit')
    return { kind: 'file', path: relative(root, path), mime: mimeOf(path), size: bytesRead, dataBase64: data.subarray(0, bytesRead).toString('base64') }
  } finally { await handle.close() }
}
