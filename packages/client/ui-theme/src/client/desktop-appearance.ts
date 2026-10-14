/** Synchronize native desktop controls through WebView2's page-scoped bridge. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeRuntime } from './index.ts'
import { isThemePreference } from '../theme-settings.ts'

/**
 * Install native preference events for this plugin lifetime.
 * @param ctx - Scoped client context owning the listeners.
 * @param theme - Live preference service synchronized with the desktop shell.
 */
export function installDesktopAppearance(ctx: ClientContext, theme: ThemeRuntime): void {
  if (typeof window === 'undefined') return
  const desktop = (window as Window & { chrome?: { webview?: { postMessage(value: unknown): void } } }).chrome?.webview
  if (!desktop) return
  const publish = (): void => {
    const state = theme.getTheme()
    desktop.postMessage({ type: 'moe4all-appearance', language: ctx.locale.getLocale().active, theme: state.active.id, preference: state.preference, darkPreference: state.darkPreference })
  }
  const receive = (event: Event): void => {
    const detail: unknown = (event as CustomEvent<unknown>).detail
    if (typeof detail !== 'object' || detail === null) return
    const value = detail as { language?: unknown; theme?: unknown }
    if (value.language === 'zh' || value.language === 'en') ctx.locale.setLocale(value.language)
    if (isThemePreference(value.theme)) theme.setTheme(value.theme)
  }
  ctx.on('theme/change', publish)
  ctx.on('locale/change', publish)
  ctx.effect(() => {
    window.addEventListener('moe4all-appearance', receive)
    publish()
    return () => { window.removeEventListener('moe4all-appearance', receive) }
  }, 'ui-theme: native desktop appearance')
}
