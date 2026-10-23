# Agent Note: Replayable PowerShell execution facts

Status: implemented

English | [中文](2026-10-23-pwsh-result-facts.zh.md)

## Problem

The canonical execution value contains status fields, but durable top-level results retain only rendered content without an explicit metadata projection. Consumers must parse text to distinguish a successful tool invocation from a failed command. Exit 1 and EPERM guidance also overstates what those observations prove.

## Decision

The pwsh tool projects exit, signal, timeout, cancellation, sandbox and capture facts into result metadata, without duplicating stream text. Background acknowledgements retain their job id. Command failure remains distinct from tool failure. Prompt guidance does not infer interruption or permission denial from an exit code alone. Truncation notices name saved output, not guaranteed complete output.

## Alternatives considered

A new result protocol duplicates existing ShellRunResult fields. Marking every nonzero command as a tool error loses independent outcomes. Expanding sandbox authority on every EPERM hides compatibility failures and weakens the approval rule.

## Consequences

New top-level results are replayable as structured facts; older records remain text-only. No Session format or sandbox backend changes. Consumers can adopt the metadata independently; Mneme is unchanged. Unit and real Loader tests cover the producer, while actual sandbox compatibility requires separate probes.
