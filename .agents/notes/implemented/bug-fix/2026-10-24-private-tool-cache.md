# Agent Note: Private tool cache defaults

Status: implemented

English | [中文](2026-10-24-private-tool-cache.zh.md)

## Problem

Package managers can fail before running an otherwise permitted task when their default cache is outside the sandbox's writable roots. A cache environment variable alone does not grant access.

## Decision

The workspace-write Windows ACL runner supplies missing uv/pip/npm cache variables below its already-authorized private temp directory. Caller settings remain authoritative. No additional ACL grant, eager directory creation, host fallback or language-mode change is introduced. Existing provider ownership determines reuse and disposal.

## Alternatives considered

Do not grant the user profile or global package store, override explicit paths, share writable caches across sessions, or create caches in read-only mode. Persistent shared caching requires a separate authority and lifecycle design.

## Consequences

Tools can initialize their default caches without unrelated user-directory writes. Cache reuse lasts for the live session/workspace pair, not across provider restarts. Tests verify real offline uv startup, writable defaults, same-session reuse, peer isolation, explicit outside-path denial and unchanged read-only behavior. Downloads and package installation are not part of validation.
