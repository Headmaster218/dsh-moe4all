# Agent Note: 私有工具缓存默认值

Status: implemented

[English](2026-10-24-private-tool-cache.md) | 中文

## Problem

包管理器的默认缓存若在沙箱可写范围之外，本可获准的任务也可能在初始化时失败。设置缓存环境变量本身不授予权限。

## Decision

workspace-write 的 Windows ACL runner 将未配置的 uv/pip/npm 缓存变量放在已有授权的私有临时目录下。调用方配置仍优先，不增加 ACL 授权，不提前创建目录，不回退宿主执行，也不改变语言模式。复用和释放由现有 provider 生命周期决定。

## Alternatives considered

不授权用户 profile 或全局包仓库，不覆盖显式路径，不在会话之间共享可写缓存，不在 read-only 下创建缓存。持久共享缓存需要单独设计权限和生命周期。

## Consequences

工具可初始化默认缓存，无需向无关用户目录写入。复用限定为活跃会话/工作区对，不跨 provider 重启。实测覆盖离线 uv 启动、默认路径可写、同会话复用、跨会话隔离、显式外部路径仍被拒，以及 read-only 行为不变。验证不下载或安装包。
