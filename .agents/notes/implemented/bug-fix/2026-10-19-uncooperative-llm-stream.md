# Uncooperative model streams cannot hold cancellation indefinitely

Status: implemented

## Problem

The idle watchdog only notified the upstream iterator. If an SDK ignored that signal, its pending `next()` stayed unresolved. Even a cancellation race around `next()` could then block again while awaiting the async generator's queued `return()`.

## Decision

The pi-ai adapter races iteration against its existing lifetime signal. Normal cleanup remains awaited. Once cancelled, iterator cleanup is still requested and its eventual rejection observed, but it cannot delay the terminal timeout or caller-aborted result. The caller signal continues to reach the SDK. This does not claim that an uncooperative third-party SDK has released every underlying resource; it guarantees that the Agent's request path can settle. The shared timeout utility, loop scheduling, queue semantics and retry policy remain unchanged.

## Verification

Controlled tests first reproduce the notification-only hang, then cover stuck next/return, explicit cancellation, normal completion and late SDK rejection. Adapter tests verify real mock HTTP request closure and timeout classification.
