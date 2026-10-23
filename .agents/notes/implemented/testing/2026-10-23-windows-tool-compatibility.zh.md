# Agent Note: 隔离的 Windows 工具兼容性矩阵

Status: implemented

[English](2026-10-23-windows-tool-compatibility.md) | 中文

## Problem

受限令牌对不同运行时的兼容性不同，Python 和 Node 不一定采用相同的子进程 IPC。普通模拟单测无法证明真实命令是否可用。相对 tsx 加载器还会使开发模式 runner 无法在独立任务工作区启动。

## Decision

开发模式 runner 使用绝对 tsx 模块 URL。显式开启的真实后端测试，将选定的无害命令分别在 workspace-write 和明确的宿主对照中执行。记录有界输出和状态，不替换后端、不扩大被拒命令的权限、不改变默认组合。负向写入和取消测试断言实际结果。

## Alternatives considered

要求所有兼容性命令成功，会用绿色测试掩盖已有局限。自动在宿主重试被拒命令会改变被测策略。每次单测都执行联网矩阵会增加不确定性和不必要的外部请求。

## Consequences

启用矩阵需设置 DSH_RUN_SANDBOX_COMPAT=1、已有的 DSH_TEST_PYTHON 和显式 DSH_SANDBOX_COMPAT_REPORT 路径。可选 DSH_TEST_UV 覆盖离线缓存初始化。调用方通过 TEMP/TMP 隔离工作区和 runner 状态，不安装工具。报告区分命令实测失败与矩阵执行完成。守卫用例通过不代表完整隔离；取消只覆盖一个前台命令，不代表所有后代进程生命周期。
