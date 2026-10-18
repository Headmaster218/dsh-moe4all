/** Read-only Git views. No shell interpolation, hooks, external diff or textconv. */
import { execFile } from 'node:child_process'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** Decode porcelain -z paths, including rename/copy source records.
 * @param text - git status --porcelain=v1 -z output.
 * @returns Destination paths and their index/worktree status.
 */
export function parseGitChanges(text: string): Array<{ path: string; status: string }> {
  const records = text.split('\0')
  const changes = []
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!
    if (record.length < 4) continue
    const status = record.slice(0, 2)
    changes.push({ status, path: record.slice(3) })
    if (/[RC]/.test(status)) index++
  }
  return changes
}

/** Execute only the fixed read commands owned by the workbench.
 * @param root - Real workspace root.
 * @param args - Fixed Git argv plus literal path arguments, never a command string.
 * @param signal - Request cancellation.
 * @param maxBytes - Output bound.
 * @returns UTF-8 stdout. A no-index diff's exit code 1 means differences, not failure.
 */
async function gitRead(root: string, args: string[], signal: AbortSignal, maxBytes: number): Promise<string> {
  const env: NodeJS.ProcessEnv = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'LANG', 'LC_ALL']) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  try {
    const result = await execute('git', ['--no-pager', '--literal-pathspecs', '--no-optional-locks',
      '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=', '-c', 'log.showSignature=false', '-c', 'submodule.recurse=false', '-C', root, ...args], {
      encoding: 'utf8', windowsHide: true, maxBuffer: maxBytes, signal, env,
    })
    return result.stdout
  } catch (error: unknown) {
    if (args.includes('--no-index') && (error as { code?: number }).code === 1) return (error as { stdout: string }).stdout
    throw error
  }
}

/** Fetch bounded graph and exact filename-safe worktree changes.
 * @param root - Canonical session workspace.
 * @param signal - User request lifetime.
 * @param maxBytes - Output cap.
 * @returns Graph text and porcelain changes; requires the workspace to be the repository root.
 */
export async function workspaceGit(root: string, signal: AbortSignal, maxBytes: number) {
  const top = (await gitRead(root, ['rev-parse', '--show-toplevel'], signal, maxBytes)).trim()
  if (relative(root, top) !== '') throw new Error('Select the Git repository root as the workspace')
  const status = await gitRead(root, ['status', '--porcelain=v1', '-z', '--untracked-files=normal'], signal, maxBytes)
  let graph = ''
  try { graph = await gitRead(root, ['log', '--all', '--graph', '--decorate=short', '--format=%h %d %s', '--max-count=100'], signal, maxBytes) }
  catch (error: unknown) {
    // Only an unborn repository has a valid status and no commit history.
    if (!(error instanceof Error) || !/does not have any commits|bad default revision/.test(error.message)) throw error
  }
  return { kind: 'git' as const, graph, changes: parseGitChanges(status) }
}

/** Show total staged/unstaged changes for one literal workspace file.
 * @param root - Canonical session workspace.
 * @param path - Selected file path; traversal and Git metadata are refused.
 * @param signal - User request lifetime.
 * @param maxBytes - Output cap.
 * @returns Unified diff; untracked files compare against the empty file.
 */
export async function workspaceGitDiff(root: string, path: string, signal: AbortSignal, maxBytes: number) {
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || rel.split(sep).includes('.git')) throw new Error('Invalid workspace diff path')
  const status = await gitRead(root, ['status', '--porcelain=v1', '-z', '--', rel], signal, maxBytes)
  const untracked = parseGitChanges(status).some(change => change.status === '??')
  let text: string
  if (untracked) text = await gitRead(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-index', '--', '/dev/null', rel], signal, maxBytes)
  else {
    // HEAD may be unborn. In that case only the index can contain a tracked diff.
    const heads = await gitRead(root, ['rev-parse', '--revs-only', 'HEAD'], signal, maxBytes)
    text = await gitRead(root, ['diff', '--no-ext-diff', '--no-textconv', ...heads.trim() === '' ? ['--cached'] : ['HEAD'], '--', rel], signal, maxBytes)
  }
  return { kind: 'diff' as const, path: rel, text }
}
