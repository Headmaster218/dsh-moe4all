# Agent Note: 可重放的 PowerShell 执行事实

Status: implemented

[English](2026-10-23-pwsh-result-facts.md) | 中文

## Problem

规范执行值包含状态字段，但顶层持久结果没有显式元数据投影，只保留渲染内容。消费者必须解析文本才能区分工具调用成功与命令失败。exit 1 和 EPERM 的指引还夸大了这些观察能证明的事实。

## Decision

pwsh 工具将退出、signal、超时、取消、sandbox 和捕获状态投影到结果元数据，不重复流正文。后台确认保留 job id。命令失败与工具失败仍然独立。提示词不再仅凭退出码推断中断或权限拒绝。截断提示指出已保存输出，而非保证其完整。

## Alternatives considered

新增结果协议会重复 ShellRunResult 已有字段。把所有非零命令标成工具错误会丢失独立结果。每遇到 EPERM 就扩大沙箱权限，会掩盖兼容性失败并削弱批准规则。

## Consequences

新的顶层结果具有可重放的结构化事实，旧记录仍只有文本。不改变 Session 格式或沙箱后端。消费者可独立采用元数据，Mneme 不变。单测和真实 Loader 测试覆盖生产者，实际沙箱兼容性另做探测。
