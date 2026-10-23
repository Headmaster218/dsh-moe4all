# Agent Note: 遵循既有策略的 shell 环境检查

Status: implemented

[English](2026-10-24-shell-environment-inspection.md) | 中文

## Problem

可执行文件路径存在不代表解释器可用。WindowsApps 空壳、pip 来源错配、项目环境与全局解释器混用会造成反复猜测。一次性 shell 调用之间不保留激活状态。

## Decision

现有 PowerShell 工具插件新增按需调用的 shell_environment。它发现常见项目目录及 PATH 候选，并通过原执行器、会话既有沙箱策略、取消信号和有界输出检查隔离 Python 启动。显式路径不会触发回退选择。结果区分启动与依赖健康，只提供选定的环境事实。模型输入通过正常工具结果记入日志，不修改 loop，也不新建环境管理服务。

## Alternatives considered

不在启动时扫描全部环境，不立即引入 PET，不激活全局环境、不改 PATH、不下载解释器，不在发现时导入项目模块，也不将解释器文件存在认定为健康。完整环境管理独立处理。

## Consequences

模型增加一个固定工具 schema，按需请求运行时事实。每条命令超时与候选数量可配置；输出无效、截断或执行失败不认定启动成功。单测、真实 PowerShell/Python 和真实 Loader 覆盖启动成功及失败。项目依赖、Conda 激活和 DLL 健康仍需显式专项检查。
