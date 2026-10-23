# Agent Note: Policy-bound shell environment inspection

Status: implemented

English | [中文](2026-10-24-shell-environment-inspection.zh.md)

## Problem

Executable paths do not establish interpreter usability. WindowsApps placeholders, mismatched pip commands, project environments and global interpreters can cause repeated guessing. Shell activation does not persist between one-shot calls.

## Decision

The existing PowerShell tool plugin also registers an on-demand shell_environment tool. It discovers common project/PATH candidates and checks isolated Python startup through the same executor, standing sandbox policy, cancellation and bounded captures. Explicit paths never trigger fallback selection. Results distinguish startup from dependency health and expose only selected environment facts. The normal tool result provides the logged model input; no loop change or additional environment service is needed.

## Alternatives considered

Do not scan every installed environment at boot, install PET immediately, activate a global environment, change PATH, download interpreters, import project modules during discovery or treat interpreter-file existence as health. Full environment management remains separate.

## Consequences

The model gains one fixed tool schema and requests runtime facts when needed. Inspection has configurable per-command timeout and candidate count; malformed, truncated or failed output does not establish usable startup. Unit tests, real PowerShell/Python and a real Loader fixture cover failure and successful startup. Project dependencies, Conda activation and DLL health still require explicit task-specific checks.
