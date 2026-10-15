# Agent Note: Desktop notifications use the Settings section

Status: implemented

English | [中文](2026-10-16-desktop-settings-notifications.zh.md)

## Decision

Pass `openSection` through the Settings notification outlet. Capabilities consumes the notification flag and navigates into the shell-owned section; it owns no second modal. Only an unskipped new version triggers automatic navigation. Persisted operation outcomes remain visible without stealing focus. Current component status is separate from the most recent confirmed plugin-update record. Prereleases default off; legacy implicitly enabled channels reset once, while explicit subsequent choices persist. Desktop navigation places MoE4All before Plugins and Capabilities.

The native owner handles a one-time download of an entirely unconfigured local Engine. External endpoints, existing executables, installed versions and running Engines are not taken over; the coordinator never starts inference or downloads models. The native window saves normal bounds and maximization, ignores minimization and clamps restored geometry to the available screen.

## Verification

Focused client composition tests cover navigation, persisted outcomes, skips, explicit download and restart confirmation, and the themed asynchronous file chooser. Core tests cover fresh first-install eligibility, external-service preservation and channel migration. The native window-state fixture covers geometry round-trip and display bounds. These checks do not constitute inference or final release-ZIP acceptance.
