# Agent Note: PowerShell completion status padding

Status: implemented

English | [中文](2026-10-23-pwsh-padded-completion.zh.md)

## Problem

A terminal can retain spaces between a command's numeric completion status and its newline. Rejecting that line loses the command's exit code and can expose private markers through the partial-output fallback or prolong polling.

## Decision

The persistent PowerShell tool accepts ASCII spaces after the status digits and before LF or CRLF. A complete numeric status line remains mandatory; wrapper echoes and incomplete markers are not completion signals.

## Alternatives considered

**Trim arbitrary whitespace or accept bare digits.** This admits incomplete status lines and weakens the completion check. Only terminal padding spaces are accepted.

## Consequences

Zero and nonzero statuses survive padded terminal output without changing timeout, cancellation, shell reuse, or sandbox policy. Focused tests cover both newline forms and preserve the existing echo and torn-marker regressions. These tests establish parser behavior, not Windows ACL enforcement or the frequency of padding on a production terminal.
