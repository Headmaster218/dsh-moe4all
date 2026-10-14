// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { ThemeRuntime } from '../src/client/index.ts'
import { MOE4ALL_THEMES } from '../src/client/moe4all-themes.ts'
import { installDesktopAppearance } from '../src/client/desktop-appearance.ts'
import { ThemeSettingsSchema, type ThemeSettings } from '../src/theme-settings.ts'
import { bootThemeInjection } from '../src/boot-theme.ts'

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)!.map(part => Number.parseInt(part, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (high! + 0.05) / (low! + 0.05)
}

describe('MoE4All appearance', () => {
  it('follows system light/dark while retaining the chosen dark palette across reloads', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'moe4all')
    const media = Object.assign(new EventTarget(), { matches: true })
    vi.stubGlobal('matchMedia', () => media)
    vi.resetModules()
    try {
      const { ThemeRuntime: Runtime } = await import('../src/client/index.ts')
      const host = stubSettingsScope<ThemeSettings>()
      const runtime = new Runtime(new Context(), host.scope)
      runtime.setDarkTheme('green')
      runtime.setTheme('system')
      expect(runtime.getTheme().active.id).toBe('green')
      media.matches = false
      media.dispatchEvent(new Event('change'))
      expect(runtime.getTheme().active.id).toBe('white')
      media.matches = true
      media.dispatchEvent(new Event('change'))
      expect(runtime.getTheme().active.id).toBe('green')
      host.publish({ value: { preference: 'system', darkPreference: 'green' }, status: 'ready', revision: 1, writable: true })
      expect(new Runtime(new Context(), host.scope).getTheme().active.id).toBe('green')
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() }
  })
  it('uses the new palettes for legacy MoE4All light and dark preferences', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'moe4all')
    vi.resetModules()
    try {
      const { ThemeRuntime: Runtime } = await import('../src/client/index.ts')
      const runtime = new Runtime(new Context(), stubSettingsScope<ThemeSettings>().scope)
      for (const [legacy, current] of [['light', 'white'], ['dark', 'gray']] as const) {
        runtime.setTheme(legacy)
        const old = runtime.getTheme().active.tokens
        runtime.setTheme(current)
        expect(old).toEqual(runtime.getTheme().active.tokens)
      }
    } finally { vi.unstubAllEnvs(); vi.resetModules() }
  })

  it.each(MOE4ALL_THEMES)('$id keeps body, hint and button text readable', theme => {
    const token = (name: string): string => theme.tokens[`--dsw-alias-${name}`]!
    for (const bg of ['bg-base', 'bg-layer-1', 'bg-layer-2', 'interactive-bg-active', 'interactive-bg-hover']) {
      for (const text of ['label-primary', 'label-secondary', 'label-tertiary', 'state-error-primary', 'state-success-primary', 'state-warn-primary']) {
        expect(contrast(token(bg), token(text)), `${theme.id}: ${text} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const bg of ['button-primary-fill', 'button-primary-hover']) {
      expect(contrast(token(bg), token('label-primary-foreground'))).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(token('state-error-primary'), token('state-error-foreground'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('state-warn-primary'), token('state-warn-foreground'))).toBeGreaterThanOrEqual(4.5)
    for (const bg of ['bg-base', 'bg-layer-1', 'bg-layer-2']) {
      expect(contrast(token(bg), token('border-l2'))).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(MOE4ALL_THEMES)('persists $id and restores it after a fresh service', theme => {
    const ctx = new Context()
    const host = stubSettingsScope<ThemeSettings>()
    const runtime = new ThemeRuntime(ctx, host.scope)
    runtime.setTheme(theme.id)
    expect(host.set).toHaveBeenCalledWith('preference', theme.id)
    const value = ThemeSettingsSchema({ preference: theme.id })
    host.publish({ value, status: 'ready', revision: 1, writable: true })
    expect(new ThemeRuntime(ctx, host.scope).getTheme().active.id).toBe(theme.id)
    expect(bootThemeInjection(value.preference).kind).toBe('script')
  })

  it('synchronizes native language and palette selections and removes its event listener', async () => {
    const ctx = new Context()
    const locale = new LocaleRuntime(ctx)
    ctx.provide('locale', locale)
    const runtime = new ThemeRuntime(ctx, stubSettingsScope<ThemeSettings>().scope)
    const postMessage = vi.fn()
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: { postMessage } } })
    const fiber = ctx.plugin({ apply: child => { installDesktopAppearance(child as never, runtime) } })
    await fiber.await()
    window.dispatchEvent(new CustomEvent('moe4all-appearance', { detail: { language: 'en', theme: 'green' } }))
    expect(locale.getLocale().active).toBe('en')
    expect(runtime.getTheme().active.id).toBe('green')
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'moe4all-appearance', language: 'en', theme: 'green', preference: 'green', darkPreference: 'gray' })
    window.dispatchEvent(new CustomEvent('moe4all-appearance', { detail: { language: 'invalid', theme: 'invalid' } }))
    expect(runtime.getTheme().active.id).toBe('green')
    await fiber.dispose()
    window.dispatchEvent(new CustomEvent('moe4all-appearance', { detail: { language: 'zh', theme: 'white' } }))
    expect(runtime.getTheme().active.id).toBe('green')
    Reflect.deleteProperty(window, 'chrome')
  })
})
