/** Keyless transcript snapshot through a real Loader, tool registry and streamed local filesystem. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

const fixture = new URL('../../../../examples/acp-agent/tests/fixtures/fs/read-continuation/', import.meta.url)

it('replays complete long-line content and rejects stale continuation tokens', async () => {
  let report: unknown
  const driver = fileURLToPath(new URL('driver.ts', fixture))
  await runLoaderSmoke({
    label: 'read continuation Loader', tempDirPrefix: 'read-continuation-',
    binScript: driver, libBinScript: driver,
    configPath: fileURLToPath(new URL('cordis.yml', fixture)),
    tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
    inspect: async cwd => { report = JSON.parse(await readFile(join(cwd, 'read-report.json'), 'utf8')) },
  })
  expect(report).toMatchInlineSnapshot(`
    {
      "completeAtEnd": true,
      "directoryEntries": [
        "file:a.txt",
        "directory:src",
      ],
      "firstIncomplete": true,
      "fragments": [
        "0123",
        "4567",
        "89",
        "后续",
      ],
      "lineNumbers": [
        1,
        1,
        1,
        2,
      ],
      "staleRejected": true,
    }
  `)
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
