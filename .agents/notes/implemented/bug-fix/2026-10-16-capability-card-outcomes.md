# Agent Note: Capability cards report the next action

Status: implemented

English | [中文](2026-10-16-capability-card-outcomes.zh.md)

## Problem

Update rows separated versions from actions and exposed raw dependency errors without explaining whether the installed plugin had changed. Native status echoes also republished unchanged UI state.

## Decision

Keep each component's description, versions, progress, retry and restart action in one responsive card. Preparation is not activation: a ready card explicitly requests a confirmed restart, and only startup confirmation reports success. A missing Engine Manager capability is a localized prerequisite rather than a failed Engine download. Preserve raw errors under expandable details. Deduplicate validated capability messages in the page controller while retaining the framework-owned store and native updater as their existing owners.

## Alternatives considered

**Keep one sparse list and a global footer.** Rejected because a scrolled list separates a component's update from its restart action. Compact cards retain the action with its component.

**Show raw errors as the primary guidance.** Rejected because an implementation error cannot explain activation state or the next safe action. Raw details remain available without replacing that guidance.

## Consequences

Cards cost horizontal space, so narrow screens use a single column. The page does not install, retry or restart automatically; confirmation remains required.

## Verification

The desktop composition tests cover ready, failure, retry, completion, prerequisites, confirmation and repeated native snapshots without issuing downloads on notification. Runtime package compatibility and transactional switching remain the native updater's responsibility.
