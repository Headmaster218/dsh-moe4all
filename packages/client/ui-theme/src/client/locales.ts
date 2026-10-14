/** `settings.theme` namespace dictionaries (the Appearance row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'appearance.green': '森林绿',
  'appearance.black': '黑色',
  'appearance.gray': '灰色',
  'appearance.white': '白色',
  'appearance.lightMode': '明亮模式',
  'appearance.darkMode': '暗色模式',
  'appearance.followSystem': '自动跟随系统',
  'appearance.systemHint': '系统明亮时使用白色，暗色时使用上方选定的暗色配色。',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'appearance.green': 'Forest',
  'appearance.black': 'Black',
  'appearance.gray': 'Gray',
  'appearance.white': 'White',
  'appearance.lightMode': 'Light mode',
  'appearance.darkMode': 'Dark mode',
  'appearance.followSystem': 'Follow system',
  'appearance.systemHint': 'White in system light mode; the selected dark palette in system dark mode.',
} satisfies Record<ThemeKey, string>
