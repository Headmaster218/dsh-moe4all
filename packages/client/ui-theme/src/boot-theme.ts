/**
 * Theme bootstrap row for the browser's pre-plugin interval. Each index
 * render embeds the current durable built-in preference; the browser resolves
 * only `system`, then writes the same DOM fields ui-layout's ThemePresenter
 * owns after the client plugin tree activates.
 */

import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { DEFAULT_PREFERENCE, type DarkThemePreference, type ThemePreference } from './theme-settings.ts'
import { MOE4ALL_THEMES } from './moe4all-themes.ts'

/** Build the inline script body for one schema-validated built-in preference. */
function bootThemeScript(preference: ThemePreference, darkPreference: DarkThemePreference): string {
  const moe = (process.env as Record<string, string | undefined>).MOE4ALL_AGENT === '1' || process.env.DSH_CLIENT_BUILD_PROFILE === 'moe4all'
  return `(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = ['dark', 'green', 'black', 'gray'].includes(preference) || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  ${moe ? `const palettes = ${JSON.stringify(Object.fromEntries(MOE4ALL_THEMES.map(theme => [theme.id, theme.tokens])))}
  const id = preference === 'system' ? (dark ? ${JSON.stringify(darkPreference)} : 'white') : preference === 'light' ? 'white' : preference === 'dark' ? 'gray' : preference
  for (const [name, value] of Object.entries(palettes[id] || {})) document.body.style.setProperty(name, value)` : ''}
})()`
}

/**
 * The theme bootstrap as an injection row: an inline script immediately after
 * the opening body tag, before the shell mount and module script.
 * @param preference - Current Host-backed built-in preference.
 * @param darkPreference - Dark palette used by the MoE4All system-following mode.
 * @returns the body script row.
 */
export function bootThemeInjection(
  preference: ThemePreference = DEFAULT_PREFERENCE,
  darkPreference: DarkThemePreference = 'green',
): IndexInjection {
  return { kind: 'script', placement: 'body', text: bootThemeScript(preference, darkPreference) }
}
