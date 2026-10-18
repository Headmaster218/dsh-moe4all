// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readQuestions, revealQuestion } from '../src/client/navigation/questions.ts'
import { QuestionDirectory } from '../src/client/navigation/QuestionDirectory.tsx'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import { en } from '../src/client/locales.ts'
import { en as common } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'

afterEach(cleanup)
const t = makeTranslate(en, common)
const entry = (seq: number, text: string, source = 'user'): HistoryEntry => ({ event: {
  type: 'user/message', surfaceOp: 'append', seq, time: 0, data: { id: `m${seq}`, content: [{ type: 'text', text }],
    source: source === 'user' ? { kind: 'user' } : { kind: 'plugin', plugin: source },
  },
} } as HistoryEntry)

describe('question directory', () => {
  it('indexes every page in order and excludes plugin context', async () => {
    const history = vi.fn().mockResolvedValueOnce({ events: [entry(8, 'last'), entry(9, 'context', 'mneme')], hasMore: true })
      .mockResolvedValueOnce({ events: [entry(0, 'first')], hasMore: false })
    expect((await readQuestions(history, new AbortController().signal)).map(item => item.text)).toEqual(['first', 'last'])
    expect(history.mock.calls[1]?.[0]).toBe(8)
  })
  it('refuses stuck pagination and honors cancellation', async () => {
    const history = vi.fn().mockResolvedValue({ events: [entry(8, 'last')], hasMore: true })
    await expect(readQuestions(history, new AbortController().signal)).rejects.toThrow('no progress')
    const controller = new AbortController(); controller.abort()
    await expect(readQuestions(history, controller.signal)).rejects.toThrow()
  })
  it('searches before navigating and does no history work before opening', async () => {
    const loadQuestions = vi.fn().mockResolvedValue([{ seq: 2, time: 0, text: 'alpha' }, { seq: 8, time: 0, text: 'beta' }])
    const navigate = vi.fn().mockResolvedValue(undefined)
    render(<QuestionDirectory loadQuestions={loadQuestions} navigate={navigate} t={t} />)
    expect(loadQuestions).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(en['questions.title']))
    await screen.findByText('alpha')
    fireEvent.change(screen.getByLabelText(en['questions.search']), { target: { value: 'BETA' } })
    expect(screen.queryByText('alpha')).toBeNull()
    fireEvent.click(screen.getByText('beta'))
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(8, expect.any(AbortSignal)) })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  })
  it('shows a failed navigation without closing the directory', async () => {
    render(<QuestionDirectory t={t} loadQuestions={async () => [{ seq: 1, time: 0, text: 'one' }]}
      navigate={async () => { throw new Error('read failed') }} />)
    fireEvent.click(screen.getByLabelText(en['questions.title']))
    fireEvent.click(await screen.findByText('one'))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'read failedRetry')
  })
  it('only materializes earlier pages when selecting an unloaded question', async () => {
    let loaded = false
    const target = { kind: 'user', anchorSeq: 2 }
    const session = {
      open: vi.fn(async () => {}), subscribe: () => () => {},
      getSnapshot: () => ({ openState: 'open', loadingOlder: false, hasMore: !loaded,
        chat: { order: loaded ? ['a', 'z'] : ['z'], nodes: { get: (key: string) => key === 'a' ? target : { anchorSeq: 9 } } } }),
      loadOlder: vi.fn(async () => { loaded = true }),
    } as unknown as SessionFace
    await revealQuestion(session, 2, new AbortController().signal)
    expect(session.loadOlder).toHaveBeenCalledOnce()
  })
})
