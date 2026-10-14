# Agent Note: MoE4All desktop appearance

Status: implemented

English | [中文](2026-10-15-moe4all-appearance.zh.md)

## Problem

An independent desktop product needs distinct colors without isolating its plugins from the existing theme and locale ecosystem. Bright button fills can make inherited white labels unreadable, and native startup controls need to agree with the loaded application.

## Decision

Four built-in palettes override semantic alias tokens rather than rewriting plugin styles for each color. The MoE4All settings picker shows Forest, Black, Gray and White; legacy ids remain valid. Body, hint, disabled and status text use readable semantic colors, and filled controls use paired foreground tokens instead of unconditional white. Theme contrast tests cover normal surfaces, hover, selected surfaces and primary buttons.

The existing locale and theme services own application preferences. A scoped WebView2 message bridge mirrors their resolved values to the native caption and startup cache; the cache does not replace Host settings. Listener disposal follows the theme plugin lifetime. Local profiles persist their preferences, while remote-browser preferences retain the existing process-local policy.

## Alternatives considered

**Independent native and plugin preferences** leave a mixed-language, mixed-color window and create competing persistence rules. The scoped bridge preserves the established service ownership.

**Replacing legacy light and dark ids** changes the meaning of existing profiles. Additional named palettes let the MoE4All picker evolve without invalidating those settings.

## Final Desktop Iteration

Language, appearance and update actions move into Settings; the native preference toolbar and WinForms update dialog are removed. Four palettes carry light/dark labels. Follow system retains a chosen dark palette, uses White in light mode and survives restarts. Forest now uses charcoal surfaces and muted green accents. Shared palette data also drives the pre-plugin interval. WebView2 mirrors preferences and resolved appearance to the startup cache. DWM colors native captions and best-effort picker captions without modifying system settings or other applications. Startup, extraction and failures use embedded HTML; the native startup surface is a fallback when WebView2 is missing.

The persistent `settings.notification` outlet keeps update notifications available while Settings is closed. Its controller owns presentation and disposal; the native shell validates the exact loopback origin and a fixed command set. PowerShell retains installation, data preservation and rollback. Detection never installs; Install requires an available release and an explicit user action. Progress can be dismissed and reopened. Verification covers malformed messages, confirmation, system transitions, persistence, assembled plugin contrast, native fallback/DWM and embedded-page viewports; it does not claim a full release-archive update installation test.

## Consequences

Real desktop testing exposed a legacy model-plugin popover that could cover the update Modal. Settings now portals its overlay to the document body and marks that ownership; the plugin only applies its old top-layer compatibility fallback when that marker is absent. Shared Modals sit above Settings. This preserves old-host compatibility and prevents visible but unclickable update controls during onboarding.

Token-aware third-party plugins follow the palettes automatically; plugins with hardcoded colors still need their own audit. Fixed category colors used only by decorative graph marks remain separate from text. The changes do not modify inference requests or engine scheduling. Verification includes preference round-trips, bridge lifetime and contrast tests, plus assembled application screenshots in both languages and all four palettes.
