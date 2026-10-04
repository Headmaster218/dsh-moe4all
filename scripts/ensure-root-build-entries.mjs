import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The private root has no runtime sources, but tsdown shares its fallback
// entries with workspace packages that do. Keep the root resolvable on a clean build.
const directory = resolve(import.meta.dirname, '..', 'lib', 'types')
mkdirSync(directory, { recursive: true })
for (const name of ['index', 'invariant', 'startup']) {
  writeFileSync(resolve(directory, `${name}.js`), 'export {}\n')
}
