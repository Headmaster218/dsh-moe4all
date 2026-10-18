// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReasoningEditor, validReasoningEfforts } from '../src/client/ReasoningEditor.tsx'
import { ModelListEditor } from '../src/client/ModelListEditor.tsx'
import { validateDeepSeekModels } from '../src/client/DeepSeekModelsEditor.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const t = (key: keyof typeof en): string => en[key]

describe('custom API model reasoning', () => {
  it('edits per-model wire mappings, preserves hidden fields, and restores inheritance', () => {
    let saved: unknown
    function Editor() {
      const [models, setModels] = useState([{ id: 'local', compat: { thinkingFormat: 'qwen' } }])
      return <ModelListEditor models={models} onChange={next => { saved = next; setModels(next as typeof models) }}
        probe={{ settingsNs: 'llm-pi-ai' }} api={{} as never} t={t} disabled={false} />
    }
    render(<Editor />)
    fireEvent.click(screen.getByLabelText(`${en.modelAdvanced} 1`))
    fireEvent.change(screen.getByLabelText(`${en.modelReasoning} 1`), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText(`${en.reasoningWire} off 1`), { target: { value: 'none' } })
    expect(saved).toEqual([{ id: 'local', compat: { thinkingFormat: 'qwen' },
      reasoningEfforts: { off: 'none', low: 'low', medium: 'medium', high: 'high' } }])
    fireEvent.change(screen.getByLabelText(`${en.modelReasoning} 1`), { target: { value: 'disabled' } })
    expect(saved).toEqual([{ id: 'local', compat: { thinkingFormat: 'qwen' }, reasoningEfforts: false }])
    fireEvent.change(screen.getByLabelText(`${en.modelReasoning} 1`), { target: { value: 'inherit' } })
    expect(saved).toEqual([{ id: 'local', compat: { thinkingFormat: 'qwen' } }])
  })

  it('blocks off-only, unknown, empty and malformed declarations before saving', () => {
    for (const reasoningEfforts of [{ off: null }, {}, { high: '' }, { high: null }, { turbo: 'yes' }, true, null]) {
      expect(validReasoningEfforts(reasoningEfforts)).toBe(false)
      expect(validateDeepSeekModels([{ id: 'a', reasoningEfforts }])?.key).toBe('modelReasoningInvalid')
    }
    for (const value of [undefined, false, { high: 'high' }, { off: null, medium: 'medium' }]) {
      expect(validReasoningEfforts(value)).toBe(true)
    }
  })

  it('does not allow writes to disabled model settings', () => {
    render(<ReasoningEditor value={{ off: null, high: 'high' }} onChange={() => { throw new Error('readonly') }}
      disabled index={0} t={t} />)
    expect((screen.getByLabelText(`${en.modelReasoning} 1`) as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText(`${en.reasoningWire} high 1`) as HTMLInputElement).disabled).toBe(true)
  })
})
