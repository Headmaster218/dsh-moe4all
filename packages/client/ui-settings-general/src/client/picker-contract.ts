/** Bounded, native-authored filesystem view for the shared themed chooser. */
export interface PickerSnapshot {
  id: string
  kind: 'directory' | 'model' | 'engine'
  path: string
  parent: string
  roots: string[]
  loading: boolean
  error: string
  truncated: boolean
  entries: { name: string; path: string; directory: boolean }[]
}

/** Validate the desktop process boundary before filesystem data reaches rendering. */
export function pickerSnapshot(value: unknown): PickerSnapshot | undefined {
  if (typeof value !== 'object' || !value) return
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !/^[a-f0-9]{32}$/u.test(row.id) || !['directory', 'model', 'engine'].includes(String(row.kind))
    || typeof row.path !== 'string' || typeof row.parent !== 'string' || typeof row.error !== 'string' || typeof row.loading !== 'boolean'
    || !Array.isArray(row.roots) || row.roots.length > 64 || !row.roots.every(root => typeof root === 'string')
    || !Array.isArray(row.entries) || row.entries.length > 1000) return
  const entries: PickerSnapshot['entries'] = []
  for (const value of row.entries) {
    if (typeof value !== 'object' || !value) return
    const entry = value as Record<string, unknown>
    if (typeof entry.name !== 'string' || typeof entry.path !== 'string' || typeof entry.directory !== 'boolean') return
    entries.push({ name: entry.name, path: entry.path, directory: entry.directory })
  }
  entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
  return { id: row.id, kind: row.kind as PickerSnapshot['kind'], path: row.path, parent: row.parent, roots: row.roots,
    loading: row.loading, error: row.error.slice(0, 2000), truncated: row.truncated === true, entries }
}
