# Agent Note：由 MoE4All 持有的原生目录选择器

状态：已实施

[English](2026-10-14-moe4all-owned-native-picker.md) | 中文

## 问题

MoE4All 在自己的桌面窗口中嵌入 DSH Web UI。由 Node host 创建的 Windows 选择器与该窗口没有所属关系，因此可能出现在产品窗口后方，或让用户感觉交互是由后台 Node 进程发起的。

## 决策

MoE4All launcher 暴露一个临时的、仅限 loopback 的选择器桥接，并使用每进程随机 token 鉴权。子 DSH 进程仅通过进程内环境变量获得 endpoint 与 token。`directory-picker-native` 会优先使用该桥接，并继续转发调用方的 abort signal；没有桥接时再走原有平台实现。

该桥接是可选的 host 能力，不改变 DSH 的产品身份或持久配置。独立 DSH 不会收到这些环境变量，仍使用现有 Win32 COM 子进程选择器。系统不会创建持久端口、token 或用户设置。

## 结果

- MoE4All 的目录对话框由 MoE4All 桌面窗口持有，并对其形成模态关系。
- DSH 与 MoE4All 可以同时运行，不共享选择器状态。
- 桥接只接受经过鉴权的 loopback POST 请求，且只暴露目录和模型选择路由。
- 现有 macOS、Linux 与独立 Windows 行为继续作为兼容路径。
