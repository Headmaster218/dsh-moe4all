# Session file workbench

Status: implemented

## Decision

The conversation's existing details panel and a narrow-screen view tab share one session store for opened files and the active mode. Workspace reads use the selected session's root through the existing gateway; they neither resume an Agent nor accept a browser-selected read root. File links open the workbench; opening the system application is a separate user action. Changes come only from successful, settled tool diff cards in loaded history, grouped by their logged turn, including nested calls. Files and Git data refresh on explicit gestures, not streamed tokens.

## Preview and Git safety

Text, Markdown and images use existing primitives. HTML assets are bounded and resolved through the workspace reader. Interactive HTML and converted PPTX slides run in an opaque-origin iframe with a network-denying CSP and no host bridge. PPTX uses pinned MIT renderer `@jvmr/pptx-to-html@1.1.2`; ZIP expansion is capped before conversion. Complex Office animation/layout fidelity is not guaranteed; PDF, legacy PPT, Word and Excel use the explicit system-open action rather than an unreliable built-in viewer. Conversion remains on the browser main thread with size/entry/slide limits; worker-based rendering is deferred.

Git graph, status and per-file diffs are read-only subprocess operations with literal arguments, no shell, external diff, textconv or hooks. Graph history is bounded to 100 commits and the workspace must be the repository root. This does not implement worktrees, staging, commits, rollback or browser automation.

## Verification

Focused client tests cover real minimal PPTX conversion, ZIP limits, sandbox markup, source assets, refresh failures, cancellation, file tabs, applied nested diffs and Git transport. Host tests cover filename-safe status and read-only graph access, workspace containment and bounded reads/uploads. Component browser checks cover desktop/mobile overflow, light/dark tokens, interactive HTML and blocked parent-document access. These checks do not substitute for a packaged Agent smoke or Office fidelity testing.
