/** Cache configuration changes child defaults, not filesystem grants or caller choices. */
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { toolCacheDefaults } from '../src/tool-cache.ts'

it('keeps missing tool caches inside the authorized private root', () => {
  expect(toolCacheDefaults('/private', {})).toEqual({
    UV_CACHE_DIR: join('/private', 'tool-cache', 'uv'), PIP_CACHE_DIR: join('/private', 'tool-cache', 'pip'),
    npm_config_cache: join('/private', 'tool-cache', 'npm'),
  })
})

it('preserves explicit settings, including alternate case and explicit empty values', () => {
  const env = { UV_CACHE_DIR: '/chosen', PIP_CACHE_DIR: '', NPM_CONFIG_CACHE: '/chosen-npm' }
  expect(toolCacheDefaults('/private', env)).toEqual({})
  expect(env).toEqual({ UV_CACHE_DIR: '/chosen', PIP_CACHE_DIR: '', NPM_CONFIG_CACHE: '/chosen-npm' })
})

it('separates private roots and does not reuse a workspace peer cache', () => {
  expect(toolCacheDefaults('/a/private', {}).UV_CACHE_DIR).not.toBe(toolCacheDefaults('/b/private', {}).UV_CACHE_DIR)
})
