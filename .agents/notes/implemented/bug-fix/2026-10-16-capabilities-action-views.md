# Agent Note: Capabilities separates action, inventory and history

Status: implemented

English | [中文](2026-10-16-capabilities-action-views.zh.md)

## Decision

Keep Capabilities inside Settings, with an action summary, explicit manual check and All / Needs attention / Update history views. Cards retain component descriptions and version-bound actions. Skipped releases remain manually installable without inflating the actionable count. Preparation stages name their current work, while pending changes still require a confirmed restart. A rollback displays the restore target rather than the latest published release.

Checks and installations have different failures and retry actions. Agent-download retry keeps the confirmed version binding. A running managed Engine does not hide available updates, but its install action stays disabled until that Engine stops. Changing update settings refreshes metadata only. History is each plugin's latest confirmed update or rollback, not a fabricated complete audit log or an indefinitely displayed completion status.

## Verification

Client composition tests cover actionable filtering, skips, history, metadata retry, same-version Agent retry, rollback targets and running-Engine restrictions. The native execution layer revalidates commands and retains transaction ownership; the browser does not switch runtime files. The layout uses existing primitives and semantic theme tokens, with container-width single-column fallback and locale-owned copy.
