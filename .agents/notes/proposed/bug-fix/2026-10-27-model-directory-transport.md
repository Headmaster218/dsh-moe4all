# Agent Note: Recover model selection after transport failures

English | [中文](2026-10-27-model-directory-transport.zh.md)

Status: proposed

## Problem

Rejected model-directory and selection RPCs leave the shared directory loading or selecting indefinitely. The adapter's reasoning metadata may consequently remain unavailable, and selection errors have no stored message.

## Proposal

Record transport failures on the existing directory store, retaining accepted data. Apply the same generation and disposal checks as successful responses. Do not change model capabilities, wire protocols, permission or retry requests automatically.

## Acceptance criteria

The real client plugin composition must report failure, retain model reasoning data, and recover on an explicit retry for both directory loads and selection. Component and Host tests must continue to validate off and effort selection.
