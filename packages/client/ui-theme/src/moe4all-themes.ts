/** MoE4All palettes shared by the shell and token-based plugins. */
import type { ThemePreference } from './theme-settings.ts'

/** Shared palette data used by the pre-plugin bootstrap and client service. */
interface PaletteDefinition { id: ThemePreference; colorScheme: 'light' | 'dark'; tokens: Record<string, string> }

type PaletteColors = readonly [string, string, string, string, string, string, string, string, string, string, string, string]

function palette(id: ThemePreference, colorScheme: 'light' | 'dark', colors: PaletteColors): PaletteDefinition {
  const [base, surface, raised, sidebar, ink, muted, faint, border, accent, onAccent, hover, selected] = colors
  const button = id === 'green' ? ['#49644f', '#55725c'] : id === 'black' ? ['#454c55', '#535c66'] : id === 'gray' ? ['#53535b', '#61616a'] : [accent, '#435d73']
  return {
    id, colorScheme,
    tokens: {
      '--dsw-alias-bg-base': base,
      '--dsw-alias-bg-layer-1': surface,
      '--dsw-alias-bg-layer-2': raised,
      '--dsw-alias-bg-layer-3': raised,
      '--dsw-alias-bg-module-platform': surface,
      '--dsw-alias-bg-overlay': raised,
      '--dsw-alias-border-l1': `color-mix(in srgb, ${border} 40%, ${base})`,
      '--dsw-alias-border-l2': border,
      '--dsw-alias-label-primary': ink,
      '--dsw-alias-label-primary-bluish': ink,
      '--dsw-alias-label-secondary': muted,
      '--dsw-alias-label-tertiary': faint,
      '--dsw-alias-label-quaternary': faint,
      '--dsw-alias-label-dimmed': faint,
      '--dsw-alias-label-disabled': faint,
      '--dsw-alias-label-caption': faint,
      '--dsw-alias-label-primary-inverted': onAccent,
      '--dsw-alias-label-primary-foreground': '#ffffff',
      '--dsw-alias-brand-text': accent,
      '--dsw-control-disabled-opacity': '1',
      '--dsw-control-placeholder-color': faint,
      '--dsw-control-placeholder-opacity': '1',
      '--dsw-alias-label-error': colorScheme === 'light' ? '#ad343b' : '#f5a3aa',
      '--dsw-alias-label-success': colorScheme === 'light' ? '#2d6e4b' : '#a6d6b7',
      '--dsw-alias-label-warning': colorScheme === 'light' ? '#875816' : '#e4be7f',
      '--dsw-alias-brand-primary': accent,
      '--dsw-alias-brand-primary-new-colorprimary-new-color': accent,
      '--dsw-alias-button-primary-fill': button[0]!,
      '--dsw-alias-button-primary-hover': button[1]!,
      '--dsw-alias-button-info-fill': button[0]!,
      '--dsw-alias-button-info-hover': button[1]!,
      '--dsw-alias-button-elevated-fill': surface,
      '--dsw-alias-button-floating-fill': raised,
      '--dsw-alias-button-floating-hover': hover,
      '--dsw-alias-interactive-bg-active': selected,
      '--dsw-alias-border-l3': border,
      '--dsw-alias-interactive-bg-hover': hover,
      '--dsw-alias-interactive-bg-hover-accent': hover,
      '--dsw-alias-interactive-bg-hover-solid': hover,
      '--dsw-alias-state-business-primary': accent,
      '--dsw-alias-state-business-tertiary': hover,
      '--dsw-alias-state-error-primary': colorScheme === 'light' ? '#ad343b' : '#f5a3aa',
      '--dsw-alias-state-success-primary': colorScheme === 'light' ? '#2d6e4b' : '#a6d6b7',
      '--dsw-alias-state-warn-primary': colorScheme === 'light' ? '#875816' : '#e4be7f',
      '--dsw-alias-state-error-foreground': colorScheme === 'light' ? '#ffffff' : '#301a1c',
      '--dsw-alias-state-warn-foreground': colorScheme === 'light' ? '#ffffff' : '#302413',
      '--dsw-alias-markdown-code-block': surface,
      '--dsw-alias-markdown-code-block-banner': raised,
      '--dsw-alias-markdown-inline-code': raised,
      '--dsw-specific-bubble': surface,
      '--dsw-specific-bubble-highlight': selected,
      '--dsw-specific-input-major': raised,
      '--dsw-specific-sidebar-fill': sidebar,
      '--dsw-specific-sidebar-nav-item-active': selected,
      '--dsw-specific-sidebar-nav-item-active-accent': selected,
      '--dsw-specific-sidebar-nav-item-hover': hover,
    },
  }
}

/** Concrete palettes; Forest uses the neutral charcoal and muted green reference. */
export const MOE4ALL_THEMES: readonly (PaletteDefinition)[] = [
  palette('green', 'dark', ['#1e201e', '#252a26', '#2c322d', '#171b18', '#e5ece5', '#bdc9bf', '#afbeb2', '#829487', '#b8d2bf', '#243b2b', '#303932', '#343e36']),
  palette('black', 'dark', ['#101112', '#18191b', '#222426', '#090a0b', '#f1f2f3', '#bec1c5', '#a6abb2', '#69737f', '#e5e7eb', '#15171a', '#26292d', '#34383e']),
  palette('gray', 'dark', ['#1e1e1f', '#242426', '#303033', '#18181a', '#ededee', '#c1c1c6', '#b2b2b7', '#818187', '#dedee2', '#252528', '#36363a', '#404044']),
  palette('white', 'light', ['#fafbfc', '#ffffff', '#f1f3f5', '#eef0f2', '#24282d', '#58616b', '#59636e', '#7a8692', '#344b5e', '#ffffff', '#e9edf1', '#dde5ec']),
]
