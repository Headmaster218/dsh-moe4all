# Agent Note: Complete bounded reads of long lines

Status: implemented

English | [中文](2026-10-23-read-line-continuation.zh.md)

## Problem

The read tool clips long lines but line-based pagination cannot recover their suffix. A clipped final line can incorrectly report EOF, making missing content appear complete.

## Decision

Clipping ends the window at its first unread position. A continuation encodes the resolved file identity, version and UTF-16 position. Ordinary path resolution still applies. Resumed or clipped reads check the version before and after reading and preserve Unicode surrogate pairs. Normal complete windows retain their existing output. A byte cap too small for the first fragment fails explicitly.

## Alternatives considered

Raising fixed caps postpones the failure. Shell fallback conflicts with the read-tool policy. Stateful cursor storage adds cleanup and session ownership. A continuation checks consistency; it does not authorize access.

## Consequences

Partial reads add a stat and rescan the stream, trading repeated scanning for bounded memory and complete recoverability. Existing read-before-edit policy still accepts any observed window, not whole-file authorization. Unit tests cover chunk boundaries, Unicode, byte caps and stale identities; a real Loader snapshot verifies streamed continuation and rejection after mutation.
