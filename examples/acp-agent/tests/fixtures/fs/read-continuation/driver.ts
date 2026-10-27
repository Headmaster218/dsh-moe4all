/** Real Loader read-continuation fixture; writes only in the caller's isolated cwd. */
import { mkdir, writeFile } from 'node:fs/promises'
import { boot, resolveConfigPath } from '@deepseek-ai/dsh-app-boot'
import { CallId } from '@deepseek-ai/dsh-llm'

const config = process.argv[2]
if (config === undefined) throw new Error('read-continuation requires a config path')
await writeFile('long.txt', '0123456789\n\u540E\u7EED', 'utf8')
const ctx = await boot('read-continuation', resolveConfigPath(config, undefined))
try {
  await mkdir('overview/src', { recursive: true })
  await writeFile('overview/a.txt', 'root', 'utf8')
  await writeFile('overview/src/nested.txt', 'not listed', 'utf8')
  const directoryEntries: string[] = []
  for (const offset of [0, 1]) {
    const listing = await ctx.tools.execute({
      signal: new AbortController().signal, callId: CallId(`list-${offset}`), name: 'list_directory',
      arguments: { path: 'overview', offset },
    })
    if (listing.isError) throw new Error(JSON.stringify(listing.error))
    const page = listing.value as { entries: { name: string; type: string }[]; nextOffset?: number }
    for (const entry of page.entries) directoryEntries.push(`${entry.type}:${entry.name}`)
    if (offset === 0 && page.nextOffset !== 1) throw new Error('Missing next directory page')
    if (offset === 1 && page.nextOffset !== undefined) throw new Error('Directory page did not finish')
  }
  let continuation: string | undefined
  let firstToken: string | undefined
  let firstIncomplete = false
  let completeAtEnd = false
  const fragments: string[] = []
  const lineNumbers: number[] = []
  for (let round = 0; round < 8; round += 1) {
    const result = await ctx.tools.execute({
      signal: new AbortController().signal, callId: CallId(`read-${round}`), name: 'read',
      arguments: { file_path: 'long.txt', ...continuation === undefined ? {} : { continuation } },
    })
    if (result.isError) throw new Error(JSON.stringify(result.error))
    const value = result.value as { continuation?: string; lines: { number: number; text: string }[] }
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    if (round === 0) {
      firstIncomplete = text.includes('Content incomplete.') && !text.includes('End of file')
      firstToken = value.continuation
    }
    for (const line of value.lines) {
      fragments.push(line.text.replace(/\.\.\. \(line truncated to \d+ chars\)$/u, ''))
      lineNumbers.push(line.number)
    }
    continuation = value.continuation
    if (continuation === undefined) {
      completeAtEnd = text.includes('End of file')
      break
    }
  }
  await writeFile('long.txt', 'changed', 'utf8')
  const stale = await ctx.tools.execute({
    signal: new AbortController().signal, callId: CallId('stale'), name: 'read',
    arguments: { file_path: 'long.txt', continuation: firstToken },
  })
  await writeFile('read-report.json', JSON.stringify({
    fragments, lineNumbers, firstIncomplete, completeAtEnd, directoryEntries,
    staleRejected: stale.isError && stale.error.info?.code === 'FS_STALE_VERSION',
  }))
} finally {
  await ctx.fiber.dispose()
}
