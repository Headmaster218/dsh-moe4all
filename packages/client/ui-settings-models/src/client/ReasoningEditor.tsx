/** Per-model reasoning declarations; wire spellings remain provider-owned. */
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/** Levels understood by the installed pi-ai adapter, in escalation order. */
export const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Validate edited capability declarations without discarding unknown model fields.
 * @param value - The model's optional reasoningEfforts value.
 * @returns Whether the adapter can accept the declaration.
 */
export function validReasoningEfforts(value: unknown): boolean {
  if (value === undefined || value === false) return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.some(([level]) => level !== 'off') && entries.every(([level, wire]) =>
    REASONING_LEVELS.some(candidate => candidate === level)
    && (level === 'off' && wire === null || typeof wire === 'string' && wire.trim().length > 0))
}

/** Reasoning capability and wire-value editor for one custom API model. */
export function ReasoningEditor({ value, onChange, disabled, index, t }: {
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
  index: number
  t: (key: keyof typeof en) => string
}) {
  const mode = value === undefined ? 'inherit' : value === false ? 'disabled' : 'custom'
  const efforts = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  return <div className={styles['modelField']}>
    <label>
      <span className={styles['modelFieldLabel']}>{t('modelReasoning')}</span>
      <select className={styles['input']} aria-label={`${t('modelReasoning')} ${index + 1}`}
        disabled={disabled} value={mode} onChange={event => {
          onChange(event.target.value === 'inherit' ? undefined : event.target.value === 'disabled'
            ? false : { off: null, low: 'low', medium: 'medium', high: 'high' })
        }}>
        <option value="inherit">{t('reasoningInherit')}</option>
        <option value="disabled">{t('reasoningDisabled')}</option>
        <option value="custom">{t('reasoningCustom')}</option>
      </select>
    </label>
    {mode === 'custom' && REASONING_LEVELS.map(level => <div key={level} className={styles['modelRow']}>
      <label><input type="checkbox" disabled={disabled} checked={Object.hasOwn(efforts, level)}
        aria-label={`${t('reasoningLevel')} ${level} ${index + 1}`}
        onChange={event => {
          const next = { ...efforts }
          if (event.target.checked) next[level] = level === 'off' ? null : level
          else delete next[level]
          onChange(next)
        }} />{level}</label>
      {Object.hasOwn(efforts, level) && <input className={styles['input']} disabled={disabled}
        aria-label={`${t('reasoningWire')} ${level} ${index + 1}`}
        placeholder={level === 'off' ? t('reasoningOmit') : level}
        value={typeof efforts[level] === 'string' ? efforts[level] as string : ''}
        onChange={event => onChange({ ...efforts, [level]: level === 'off' && event.target.value === ''
          ? null : event.target.value })} />}
    </div>)}
    {!validReasoningEfforts(value) && <span role="alert" className={styles['error']}>{t('modelReasoningInvalid')}</span>}
  </div>
}
