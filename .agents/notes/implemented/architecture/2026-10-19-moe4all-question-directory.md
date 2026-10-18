# User question directory

Status: implemented

## Decision

The conversation header opens an on-demand, session-authorized history index containing only append-origin user messages. Injected context and compaction replacements are excluded. Search runs over question text; selecting a question materializes contiguous older pages through the existing Session face and sends a one-shot sequence target to Chat. Navigation disables bottom-follow, persists the reader anchor and focuses the original user row. Historical editing remains fork-based; EasyRewrite is unchanged.

## Limits

Indexing uses the existing history transport, which includes tool and assistant events in each page. No new on-disk format or storage migration is introduced. Very large histories may benefit from a future host-side compact index and targeted event windows. Cancellation stops subsequent page pulls and stale navigation cannot switch views.

## Verification

Focused tests cover pagination, user filtering, cancellation, stuck-page errors, search, navigation failure and lazy viewport loading. Existing chat tests cover scroll anchoring.
