# Agent Note: PowerShell 子命令的 Python 编码

Status: implemented

[English](2026-10-23-pwsh-python-encoding.md) | 中文

## Problem

shell 收集器按 UTF-8 解码，PowerShell 管道也输出 UTF-8，但 Windows Python 子进程仍可能选择本地代码页，导致中文 stdin 码点错误、emoji stdout 抛出 UnicodeEncodeError。

## Decision

PowerShell 执行器以子进程环境默认值提供 PYTHONUTF8=1 和 PYTHONIOENCODING=utf-8，可信调用方的显式变量优先。前台与后台复用现有 spawn 路径，不修改全局环境或安装解释器。

## Alternatives considered

全局修改代码页会影响其他应用。要求每条生成的 Python 命令手动记住 -X utf8，仍会遗漏普通脚本和间接启动的子进程。选择或修复 Python 安装是另一项职责。

## Consequences

Python 默认文本文件编码也变为 UTF-8；旧编码命令必须显式指定编码。这不修复 PowerShell 5.1 重定向输入解码或沙箱 IPC。执行器测试覆盖默认值、覆盖优先级和宿主隔离；Loader 组合验证模型可见的执行路径。
