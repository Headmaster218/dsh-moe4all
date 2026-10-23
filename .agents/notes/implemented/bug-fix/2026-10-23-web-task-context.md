# Agent Note: Separate Web orientation from Harness development instructions

Status: implemented

English | [中文](2026-10-23-web-task-context.zh.md)

## Problem

A packaged task agent receives Harness checkout and HMR instructions even when its installation is not a development checkout. Disabling all surface context also removes useful GUI orientation and the live URL.

## Decision

The Web runtime has an independent developmentContext option. False omits the Harness source section and rebuild instructions while preserving surface orientation and DSH_WEB_URL. The default remains true for existing development compositions; packaged deployments explicitly select false.

## Alternatives considered

Inferring development mode from a path or product environment variable hides a deployment choice. Disabling surfaceContext removes unrelated useful facts. Removing development instructions globally changes existing developer compositions unnecessarily.

## Consequences

Normal task deployments no longer suggest modifying installed Harness internals. Developer compositions retain their instructions. Prompt-section registration still uses the existing logged assembly mechanism; no Agent loop or Session format changes. Tests cover both modes and disposal.
