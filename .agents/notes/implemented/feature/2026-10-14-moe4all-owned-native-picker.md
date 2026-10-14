# Agent Note: MoE4All-owned native directory picker

Status: implemented

English | [中文](2026-10-14-moe4all-owned-native-picker.zh.md)

## Problem

MoE4All embeds the DSH web UI in its own desktop window. A Windows picker created by the Node host has no relationship to that window, so it can open behind the product or look as if a background Node process owns the interaction.

## Decision

The MoE4All launcher exposes an ephemeral, loopback-only picker bridge with a per-process random token. The child DSH process receives the endpoint and token through process-local environment variables. `directory-picker-native` uses that bridge before its normal platform implementation and forwards the caller's abort signal.

The bridge is an optional host capability, not a DSH identity or configuration change. Standalone DSH never receives the environment variables and continues to use its existing Win32 COM child-process picker. No persistent port, token, or user setting is created.

## Consequences

- MoE4All directory dialogs are owned by and modal to the MoE4All desktop window.
- DSH and MoE4All can run simultaneously without sharing picker state.
- The bridge accepts only authenticated loopback POST requests and exposes only directory/model selection routes.
- The existing macOS, Linux, and standalone Windows behavior remains available as the compatibility path.
