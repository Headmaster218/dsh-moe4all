# Agent Note: 受限 PowerShell 的编码初始化

Status: implemented

[English](2026-10-23-restricted-pwsh-encoding.md) | 中文

## Problem

Windows ACL 沙箱的 read-only 模式以 ConstrainedLanguage 运行 PowerShell。无条件创建 UTF8Encoding 会在每条用户命令前产生两条无关错误。改用 Encoding.UTF8 仍无法给 Console 属性赋值，还会在原生程序的管道输入中引入 BOM。

## Decision

仅在 FullLanguage 下执行原有的无 BOM 编码初始化，受限模式保留默认值，沙箱权限不变。用户命令仍作为单个字符串执行，不增加包裹。通过隔离工作区实测 read-only 下的 PS7 和 PS5.1，覆盖退出及错误行为、子程序直接输出 UTF-8 和拒绝写入。

## Alternatives considered

不放宽 ConstrainedLanguage，不修改共享控制台代码页，不静默重试为无沙箱，也不改成会输出 BOM 的管道编码。不增加通用异常包裹：它可能改变命令语义或泄露请求数据。

## Consequences

read-only 命令不再先产生编码初始化错误。受限 PowerShell 的控制台输出、PS5.1 的管道输入仍保留原有编码限制，本次不是完整的 Unicode 修复。Python 子进程的 UTF-8 默认值不变。Windows 定向实测按开关启用，不使用生产配置或 GPU。
