import { describe, expect, it } from 'vitest'
import { protocolEndpointPlaceholder, protocolLabel } from '../src/client/protocol.ts'

describe('protocol presentation', () => {
  it('names supported protocols without changing persisted identifiers', () => {
    expect(protocolLabel('openai-completions')).toBe('OpenAI Chat Completions')
    expect(protocolLabel('openai-responses')).toBe('OpenAI Responses')
    expect(protocolLabel('anthropic-messages')).toBe('Anthropic Messages')
    expect(protocolLabel('custom-api')).toBe('custom-api')
    expect(protocolLabel('constructor')).toBe('constructor')
  })
  it('uses the Anthropic SDK base without a duplicate v1 segment', () => {
    expect(protocolEndpointPlaceholder('anthropic-messages')).toBe('https://gateway.example')
    expect(protocolEndpointPlaceholder('openai-completions')).toBe('https://gateway.example/v1')
  })
})
