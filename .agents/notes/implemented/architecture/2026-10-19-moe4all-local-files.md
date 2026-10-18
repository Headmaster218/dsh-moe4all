# Local files and workspace preview access

Status: implemented

## Decision

Local files use explicit copy or reference gestures. Copies are stored under a unique workspace upload directory and never overwrite existing files; references verify an existing path without granting preview access outside the workspace. The model receives a path in ordinary user draft text and reads content through its existing tools and permissions. Mobile upload plugins are unchanged. Image-only drops retain image attachment behavior. General file drops use left/right copy/reference lanes; browsers withholding original paths require a manually entered reference path.

## Access and limits

The gateway resolves the root from the selected session, checks canonical path containment, refuses Git metadata and linked escapes, and bounds upload/preview bytes and directory results. Operations do not resume Agents. Configurable gateway limits default to 32 MiB per file and 5000 directory entries. Binary preview types use a MIME whitelist. Explicit external references return a verified path only, not file contents.

## Verification

Host tests cover unique copies, byte reads, path traversal, junction escape, reserved filenames, size bounds, cancellation and wire operation validation. Client tests cover copied bytes, original-path references, failures and draft insertion.
