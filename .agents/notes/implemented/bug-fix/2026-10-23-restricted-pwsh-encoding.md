# Agent Note: Restricted PowerShell encoding initialization

Status: implemented

English | [中文](2026-10-23-restricted-pwsh-encoding.zh.md)

## Problem

The read-only Windows ACL sandbox runs PowerShell in ConstrainedLanguage. The unconditional UTF8Encoding constructors fail before every command, producing two unrelated errors. Replacing them with Encoding.UTF8 still forbids Console property assignment and introduces a BOM in native pipeline input.

## Decision

Run the existing BOM-free encoding initialization only in FullLanguage. Leave restricted-mode defaults and sandbox authority unchanged. Keep the user's command as a single, unwrapped command string. Test real read-only PS7 and PS5.1 execution, exit/error behavior, direct UTF-8 child output, and denied writes in an isolated workspace.

## Alternatives considered

Do not weaken ConstrainedLanguage, change a shared console code page, silently retry unrestricted, or substitute BOM-emitting pipeline encoding. Do not add a blanket exception wrapper: it may alter command semantics or expose request data.

## Consequences

Read-only commands no longer begin with encoding-initialization errors. Restricted PowerShell console output and PS5.1 pipeline input retain their existing encoding limitations; this is not a complete Unicode repair. Python UTF-8 child defaults are unchanged. Tests are opt-in on Windows and do not use production profiles or a GPU.
