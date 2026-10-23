/** Defaults for package-manager caches inside an already-authorized private temp root. */
import { join } from 'node:path'

/**
 * Supply absent cache variables without overriding caller settings or creating directories.
 * @param privateTemp - existing sandbox-private temp directory; never an ambient shared root.
 * @param env - child environment inherited by the runner.
 * @returns only missing cache settings, to apply to the confined child environment.
 */
export function toolCacheDefaults(privateTemp: string, env: NodeJS.ProcessEnv): Record<string, string> {
  const tools = { UV_CACHE_DIR: 'uv', PIP_CACHE_DIR: 'pip', npm_config_cache: 'npm' }
  return Object.fromEntries(Object.entries(tools)
    .filter(([name]) => !Object.keys(env).some(key => key.toLowerCase() === name.toLowerCase() && env[key] !== undefined))
    .map(([name, tool]) => [name, join(privateTemp, 'tool-cache', tool)]))
}
