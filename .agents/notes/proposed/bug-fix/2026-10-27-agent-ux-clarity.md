# Agent Note: Bounded workspace discovery and explicit file and protocol actions

English | [中文](2026-10-27-agent-ux-clarity.zh.md)

Status: proposed

## Problem

A broad workspace request can trigger recursive discovery of ignored dependencies. Local Markdown destinations are inert even when a successful file mutation already identifies the destination. Catalog-provider protocol selection is file-only despite adapter support for explicit overrides.

## Proposal

The source draft adds non-recursive `list_directory` through the existing filesystem service, with configurable count and serialized-byte limits. It keeps ordinary read/mutation authorization unchanged. The provider still enumerates all direct children; true backend pagination is outside this change.

Settled local Markdown links reuse the owning produced-file resolver rather than opening arbitrary browser URLs. Only recorded files can resolve; ambiguous matches and unsupported schemes stay inert. This partially extends the [inline file-mention decision](../../implemented/feature/2026-08-07-web-inline-file-mentions.md), not the ownership of produced files or the streaming renderer.

Every pi-ai route exposes an explicit protocol override and catalog routes can unset it to restore their preset. Settings retain provider IDs and credential references. This partially changes the curated-field policy in the [configuration-plane decision](../../implemented/architecture/2026-07-30-web-config-plane.md); its settings ownership and minimal path writes remain intact.

## Alternatives considered

Prompt-only requests cannot provide a shallow directory operation. Recursive glob remains useful for targeted searches but is not the overview default. Arbitrary `file:` navigation would bypass the owning view's path matching. Renaming a provider to select a wire protocol would disrupt saved routes and credentials.

## Acceptance criteria

Validation includes unit and real-Loader regressions, generated tool/config catalogs, affected transcript snapshots and the assembled client. Unknown-link rejection, streaming safety, route identity and credential isolation remain required. Focused source tests do not substitute for complete runtime acceptance.

## Risks

Directory pagination is positional and can shift when children change. Files created only through shell commands have no mutation-location record and remain outside the link resolver. Protocol overrides affect all models on the selected route and do not adapt incompatible credentials or models automatically.
