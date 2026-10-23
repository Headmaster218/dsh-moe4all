# Agent Note: 持久 shell 诊断以证据为准

Status: implemented

[English](2026-10-23-persistent-shell-diagnostics.md) | 中文

## Problem

命令到达时限只能证明超时，不能证明内存不足。把配置时限取整为秒，还会将不足一秒的正时限报告为零秒。误导性诊断会让模型采取无关的恢复措施。

## Decision

持久 PowerShell 与 Bash 只报告观测到的超时，保留小数秒、受限的部分输出，并说明 shell 重置。重置与取消行为保持不变。

## Alternatives considered

**保留 OOM 作为可能解释。** 时限没有提供内存故障证据，这会混淆观测与猜测。

## Consequences

模型能得到准确的时限，并区分已经重置的 shell 与仍保留原状态的 shell。定向测试固定超时文案，验证部分输出及下次调用使用全新 shell。不引入新的故障分类器、权限降级或自动重试。
