# Agent Note: PowerShell 完成状态的填充空格

Status: implemented

[English](2026-10-23-pwsh-padded-completion.md) | 中文

## Problem

终端可能在命令的数字完成状态与换行之间保留空格。拒绝这样的状态行会丢失命令退出码，还可能通过部分输出回退暴露私有标记，或者延长轮询。

## Decision

持久 PowerShell 工具允许状态数字之后、LF 或 CRLF 之前出现 ASCII 空格。仍然必须存在完整的数字状态行；包装器回显和不完整标记不是完成信号。

## Alternatives considered

**裁掉任意空白或接受没有换行的数字。** 这会接受不完整的状态行，削弱完成判定，因此只接受终端填充空格。

## Consequences

终端输出带填充空格时，零与非零状态都能保留，不改变超时、取消、shell 复用或沙箱策略。定向测试覆盖两种换行，并保留已有的回显和分片标记回归测试。这些测试确认解析行为，不代表验证了 Windows ACL 隔离，也不代表测得了生产终端出现填充的频率。
