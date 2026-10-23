# Agent Note: Python encoding in PowerShell child commands

Status: implemented

English | [中文](2026-10-23-pwsh-python-encoding.zh.md)

## Problem

The shell collector decodes UTF-8 and PowerShell emits UTF-8 pipelines, but a Windows Python child can still select the locale encoding. Chinese stdin becomes incorrect code points and emoji stdout can raise UnicodeEncodeError.

## Decision

The PowerShell executor supplies PYTHONUTF8=1 and PYTHONIOENCODING=utf-8 as child environment defaults. Explicit trusted request variables retain precedence. Both foreground and background commands use the existing spawn path; no global environment or interpreter installation changes.

## Alternatives considered

Global code-page changes affect unrelated applications. Requiring every generated Python command to remember -X utf8 leaves the same failure in ordinary scripts and indirect child launches. Selecting or repairing Python installations is a separate concern.

## Consequences

Python text-file defaults also become UTF-8; legacy commands must explicitly request their encoding. This does not fix PowerShell 5.1 redirected input decoding or sandbox IPC. Executor tests cover defaults, override precedence and host isolation; the Loader composition verifies the model-facing execution path.
