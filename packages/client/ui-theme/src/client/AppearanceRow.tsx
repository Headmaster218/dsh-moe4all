/**
 * Appearance preference row registered into the General section item slot.
 * MoE4All exposes four palettes; other profiles keep the light/dark/system picker.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import clsx from 'clsx'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { DarkThemePreference, ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  setDarkTheme: (id: DarkThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  ...(process.env.DSH_CLIENT_BUILD_PROFILE === 'moe4all' ? [
    { id: 'white' as const, labelKey: 'appearance.white' as const, Icon: IconLightOutline16 },
    { id: 'green' as const, labelKey: 'appearance.green' as const, Icon: IconDarkOutline16 },
    { id: 'black' as const, labelKey: 'appearance.black' as const, Icon: IconDarkOutline16 },
    { id: 'gray' as const, labelKey: 'appearance.gray' as const, Icon: IconDarkOutline16 },
  ] : [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
  ] as const),
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, setDarkTheme, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const darkPreference = useStore(s => s.darkPreference)
  const activeId = useStore(s => s.activeId)
  const moe = process.env.DSH_CLIENT_BUILD_PROFILE === 'moe4all'
  const selected = process.env.DSH_CLIENT_BUILD_PROFILE === 'moe4all'
    ? preference === 'dark' ? 'gray' : preference === 'light' ? 'white' : preference
    : preference
  return (
    <div className={css.group}>
      <div className={css.heading}>
        <div className={css.title}>{t('appearance.title')}</div>
        {moe && <label className={css.auto}>
          <input type="checkbox" checked={preference === 'system'} onChange={e => {
            if (e.target.checked) {
              if (preference === 'green' || preference === 'gray' || preference === 'black') setDarkTheme(preference)
              setTheme('system')
            } else setTheme(activeId === 'light' ? 'white' : activeId === 'dark' ? darkPreference : activeId as ThemePreference)
          }} />
          {t('appearance.followSystem')}
        </label>}
      </div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, (preference === 'system' && moe ? id === darkPreference : selected === id) && css.selected)}
            aria-pressed={preference === 'system' && moe ? id === darkPreference : selected === id}
            data-theme={id}
            onClick={() => {
              if (moe && id !== 'white' && id !== 'light' && id !== 'dark' && id !== 'system') {
                setDarkTheme(id)
                if (preference !== 'system') setTheme(id)
              } else setTheme(id)
            }}
          >
            <Icon />
            {t(labelKey)}
            {moe && <span className={css.mode}>{t(id === 'white' ? 'appearance.lightMode' : 'appearance.darkMode')}</span>}
          </button>
        ))}
      </div>
      {moe && preference === 'system' && <div className={css.followHint}>{t('appearance.systemHint')}</div>}
    </div>
  )
}
