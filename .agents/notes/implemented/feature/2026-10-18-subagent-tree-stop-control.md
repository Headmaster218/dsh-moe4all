# Agent Note: Stop a running child from the subagent tree

Status: implemented

English | [中文](2026-10-18-subagent-tree-stop-control.zh.md)

## Problem

The subagent catalog showed which children were running, but a user had to open a child conversation before using its Stop control. That made the tree useful for observation, not operational management.

## Decision

Show a compact Stop action only on a running continuable child row. Route it through the existing addressed `subagent.interrupt` RPC; do not add a parallel cancellation path, stop one-shot tasks, or navigate away from the catalog. The RPC interrupts the current turn while preserving the child Activation and its queued follow-ups.

After an accepted interrupt, request a catalog refresh and keep the action in a stopping state until the authoritative catalog reports inactivity. Surface rejected/failed requests inline on the corresponding row. The action stops propagation so the same click cannot also open the child. Localized accessible names identify both Stop and Stopping states.

The open catalog also shows running descendant count and known cumulative token usage for the uninterrupted subagent subtree. Usage is historical session consumption, not live throughput. If only some descendants expose token usage, prefix the aggregate with `≥`; show unavailable when none do.

## Validation

The component test verifies the exact parent/child address and confirms the stop gesture does not navigate. Runtime session-service tests cover the UI action's RPC bridge. Package bundle generation and focused tests pass.

## Model Experience

### What the model sees

Nothing. Stopping from the tree calls the same user-authorized interrupt RPC as the conversation Stop action and does not create a prompt or transcript event.

### Token effect

None for the control itself. Work already claimed by the interrupted turn is not requeued; pending follow-ups remain queued according to the existing interrupt contract.

### KV Cache effect

None. No prompt or cache state is edited by the catalog action.
