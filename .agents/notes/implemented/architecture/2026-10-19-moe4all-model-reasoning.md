# Per-model reasoning settings

Status: implemented

## Decision

The custom API model editor writes the existing pi-ai `reasoningEfforts` field. Inheritance removes the override, non-reasoning stores `false`, and custom levels preserve explicit wire values including the nullable `off` omission. Unsupported declarations are rejected before settings mutation. Provider compatibility fields remain unchanged; declaring levels does not make an endpoint implement them.

## Verification

Focused client tests cover per-model editing, hidden-field preservation, inheritance, read-only controls and validation. Existing adapter catalog tests own request dispatch; no model or GPU is required.
