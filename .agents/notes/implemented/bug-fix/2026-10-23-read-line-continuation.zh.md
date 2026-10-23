# Agent Note: 长单行的完整有界读取

Status: implemented

[English](2026-10-23-read-line-continuation.md) | 中文

## Problem

read 工具裁剪长单行，但按行分页无法取回其后缀。最后一行截断时可能错误报告 EOF，让遗漏内容看起来已经完整。

## Decision

截断时将窗口停在第一个未读位置。续读值编码已解析的文件身份、版本和 UTF-16 位置，常规路径解析仍然生效。续读或截断的读取前后核验版本，并保留完整 Unicode 代理对。普通完整窗口保持已有输出。字节上限不足以返回首个片段时显式失败。

## Alternatives considered

提高固定上限只能推迟问题。回退 shell 与 read 工具策略冲突。有状态游标会增加清理和会话归属问题。续读值检查连续性，不授予访问权限。

## Consequences

部分读取会增加一次 stat 并重新扫描流，用重复扫描换取有界内存和内容可完整恢复。既有 read-before-edit 策略仍接受任意已观察窗口，不要求整文件授权。单测覆盖块边界、Unicode、字节上限和过期身份；真实 Loader 快照验证流式续读和修改后的拒绝。
