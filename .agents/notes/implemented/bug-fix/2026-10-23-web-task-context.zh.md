# Agent Note: 分离 Web 定位与 Harness 开发说明

Status: implemented

[English](2026-10-23-web-task-context.md) | 中文

## Problem

打包的任务 Agent 会接收 Harness checkout 与 HMR 说明，即使安装目录不是开发源码。关闭全部界面上下文又会丢失有用的 GUI 定位和实时 URL。

## Decision

Web 运行时提供独立的 developmentContext 选项。设为 false 时不注册 Harness 源码段落和重建说明，保留界面定位与 DSH_WEB_URL。默认 true 保持已有开发组合行为，打包部署显式选 false。

## Alternatives considered

根据路径或产品环境变量猜开发模式会隐藏部署选择。关闭 surfaceContext 会移除其他有用事实。全局移除开发说明则不必要地改变既有开发组合。

## Consequences

普通任务部署不再引导修改安装内的 Harness 实现，开发组合保留原说明。提示词仍通过现有可记录的组装机制注册，不改变 Agent loop 或 Session 格式。测试覆盖两种模式和释放行为。
