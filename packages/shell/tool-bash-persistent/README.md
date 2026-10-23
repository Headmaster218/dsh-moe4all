# @deepseek-ai/dsh-tool-bash-persistent

English | [中文](README.zh.md)

Model-facing `bash(command)` backed by one owner-scoped `ctx.terminals` shell. The package owns the tool contract and shell reuse; deployments select the PTY backend and sandbox policy.

## Config

| Key | Default | Meaning |
|---|---:|---|
| `backendType` | `shell` | Registered PTY backend used for each Agent shell. |
| `timeoutMs` | `300000` | Wall-clock limit for one command; timeout closes the shell. |
| `maxOutputBytes` | `4000` | Maximum retained UTF-8 command-output bytes; fixed diagnostics are added afterward. |
| `maxOutputChars` | Unset | Deprecated alias, used as a byte limit only when `maxOutputBytes` is unset. |
| `description` | Persistent-shell description | Model-facing environment contract. |

## Model Experience

### Tool schema

#### What the model sees

The generated [`bash` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-bash-persistent), including the configured `description`. The plugin contributes no standalone system-prompt section; the deployment owns persona and environment guidance.

#### Token effect

Fixed schema cost while `bash` is visible.

#### KV Cache effect

Prefix-stable while the configured description and schema remain unchanged.

### Tool results

#### What the model sees

Commands share one shell per Agent, so cwd, exported variables, activated environments, functions, and background jobs persist across calls. Results exclude private completion markers. When the shell reads stdin again without having printed the completion marker — after `exec`, an interrupt, or an interactive foreground child whose stdin wait the provider proves — the call returns the captured partial output, which can end with the backend's own prompt text. A nonzero wrapped command appends `[exit code: N]`; a shell that exits before reporting that status instead appends `[shell exited: code N]`, `[shell killed by signal: SIG]`, or `[shell exited]` when the backend supplies neither, then resets and tells the model that the next call starts fresh. Long output keeps the earliest retained prefix plus a clipping notice. If the PTY has already dropped that prefix, the result says so explicitly instead of presenting a tail as complete output. Timeout returns bounded partial output, closes the uncertain shell, and reports the reset.

Timeout diagnostics report the configured limit in seconds, including subsecond limits, without inferring an out-of-memory failure.

Clipping advice refers to command output, not an assumed file. It suggests narrowing read-only queries or inspecting output already saved by the command, and warns against rerunning side-effecting commands merely to recover omitted output. The tool does not create a full-output file.

#### Token effect

Data-dependent. `maxOutputBytes` bounds retained command output without splitting a UTF-8 character; fixed clipping, lost-prefix, status, timeout, and reset diagnostics can extend the result.

#### KV Cache effect

Append-only tool results follow the reusable request prefix.

## Known Limitations and Deferred Work

- The tool requires an owning Agent and a real PTY backend.
- An interactive foreground child (for example a REPL) returns early with partial output only where the subprocess provider proves its stdin wait; elsewhere the call runs to `timeoutMs`.
- Explicit `exit` and timeout discard shell state. Cancellation also resets and discards the result, even when a complete status marker is already observable; the next call starts a fresh shell.
- Environment facts such as network access and package mirrors belong in the configured `description`, not this package's default.
