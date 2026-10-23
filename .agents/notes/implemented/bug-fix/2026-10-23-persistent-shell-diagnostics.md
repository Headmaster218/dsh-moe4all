# Agent Note: Evidence-based persistent shell diagnostics

Status: implemented

English | [中文](2026-10-23-persistent-shell-diagnostics.zh.md)

## Problem

A command deadline establishes a timeout, not an out-of-memory failure. Rounding its configured limit to whole seconds can also report a positive subsecond timeout as zero seconds. Misleading diagnostics send the model toward unrelated recovery actions.

## Decision

Persistent PowerShell and Bash report only the observed timeout, retain fractional seconds, preserve bounded partial output, and describe the shell reset. Reset and cancellation behavior remain unchanged.

Clipping diagnostics describe incomplete command output without assuming a source file or a full-output artifact. They suggest narrower read-only queries or output already saved by the command, and warn against rerunning side-effecting commands for omitted output. Output limits and lost-scrollback-prefix diagnostics remain unchanged.

## Alternatives considered

**Keep OOM as a possible explanation.** The deadline supplies no memory-failure evidence, so this mixes observation with speculation.

**Always suggest rerunning the command or searching a file.** Commands need not read a file and may have side effects; recovery advice cannot assume either condition.

## Consequences

The model receives a factual time limit and can distinguish a reset shell from one retaining prior state. Focused tests pin the timeout text and verify partial output plus a fresh shell on the next call. No new failure classifier, permission downgrade, or automatic retry is introduced.
