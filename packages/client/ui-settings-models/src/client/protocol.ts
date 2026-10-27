/** Human-facing names and endpoint conventions for explicitly selected wire protocols. */

/**
 * Name a protocol without changing the identifier stored in settings.
 * @param protocol - adapter-reported wire identifier.
 * @returns the product name, or the unchanged identifier for an unknown protocol.
 */
export function protocolLabel(protocol: string): string {
  switch (protocol) {
    case 'openai-completions': return 'OpenAI Chat Completions'
    case 'openai-responses': return 'OpenAI Responses'
    case 'anthropic-messages': return 'Anthropic Messages'
    default: return protocol
  }
}

/**
 * Suggest the base endpoint expected by a protocol's SDK.
 * @param protocol - selected wire identifier.
 * @returns a non-production example endpoint; never a replacement for entered text.
 */
export function protocolEndpointPlaceholder(protocol: string): string {
  return protocol === 'anthropic-messages' ? 'https://gateway.example' : 'https://gateway.example/v1'
}
