# Agent Note: Isolated Windows tool compatibility matrix

Status: implemented

English | [中文](2026-10-23-windows-tool-compatibility.zh.md)

## Problem

Restricted-token compatibility differs between runtimes: Python and Node do not necessarily use the same child-process IPC. Ordinary unit fakes cannot establish which real commands work. A relative tsx loader also prevents the development runner from starting in an independent task workspace.

## Decision

The development runner uses an absolute tsx module URL. An opt-in real-backend test compares explicitly chosen benign commands under workspace-write and an explicit host reference. It records bounded outputs and status without substituting a backend, widening a denied invocation or changing default composition. Negative write tests and cancellation assert the actual outcome.

## Alternatives considered

Requiring every compatibility case to succeed hides known limitations behind a green test. Automatically retrying denied commands on the host changes the tested policy. Running the network matrix in every unit invocation adds nondeterminism and unnecessary external traffic.

## Consequences

Enable the matrix with DSH_RUN_SANDBOX_COMPAT=1, an existing DSH_TEST_PYTHON and an explicit DSH_SANDBOX_COMPAT_REPORT path. DSH_TEST_UV optionally covers offline cache initialization. The caller selects TEMP/TMP to isolate all workspaces and runner state; no tools are installed. The report distinguishes observed command failures from matrix completion. Passing guards do not establish full confinement, and cancellation coverage is one foreground command, not every descendant lifecycle.
