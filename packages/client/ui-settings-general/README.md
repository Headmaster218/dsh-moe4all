# @deepseek-ai/dsh-client-ui-settings-general

English | [中文](README.zh.md)

Settings shell, ownerless copy, and durable product-onboarding namespace. It occupies `sidebar.settings` with the trigger chrome and modal settings panel, projects the `settings.section` ledger into the navigation and the `settings.onboarding` ledger into one mounted step at a time, and registers everything on the Settings pages that belongs to no single feature — the trigger/header/close chrome content, the local configuration-file action, the General section and its `settings.general.item` slot, and the `settings` dictionaries. The slot types it renders into belong to ui-settings, the settings domain base; only the shell's own contract types live here, because they reference ui-sidebar's slot type and the base layer must depend on no `ui-*` package. Feature-owned rows (Permission, Language, Appearance), sections (Models), and conditional onboarding steps stay with their feature packages.

The shell ships no onboarding copy of its own — all text arrives from registrants. Nav labels may be locale-following thunks, so the nav projection resolves them through `resolveSlotLabel` and re-renders on the section ledger bump or the locale revision (an optional `ctx.get('locale')` read; no hard locale dependency). The onboarding ledger projects in ascending order and mounts exactly one step at a time. Visible steps own their dialog chrome and app-root `inert` lifecycle; a mounted step still resolving private facts renders null, so nothing paints or blocks while it decides. The active registrant receives its id, `complete()`, and an `openSection(id)` callback; completing or skipping transfers ownership to the next entry. Registrants own durable completion, capability readiness, copy, mutations, and their visible wrapper, so independently registered flows cannot stack and the shell does not become a second configuration fact source.

A loopback browser loads the provider's `hasDocument` capability through `settings.describe` and renders **Open configuration file** only when the Host confirms that a provider-owned local document can be prepared. The action sends the pathless, loopback-only `settings.openDocument` request; the Host resolves the provider path again, materializes an absent document, and hands it to a native text editor (`open -t` on macOS, bypassing a browser file association; the desktop file association on Linux and Windows; Windows association after `wslpath -w` translation on WSL). Open failures keep the action available and render a localized error. Reopening the dialog or reconnecting refreshes availability after a transient read failure or Host topology change. Remote browsers never register the action and never issue the privileged settings read.

The Host half registers `ui-onboarding` in the user-settings seam. The welcome step contributed by `ui-settings-models` reads and writes its `welcomeNoticeVersion` through the existing public settings boundary; the shell itself remains policy-free.

MoE4All desktop deployments order MoE4All before Plugins and Capabilities in Settings. The persistent `settings.notification` outlet receives the shell's `openSection` callback: an unskipped new-version notification navigates to the existing Capabilities section, never to a separate modal. Stored completion, prepared changes and background errors do not open Settings. A page-scoped controller validates native messages and persists exact component/version skips through the native owner. Skips suppress automatic reminders, not manual installation or later versions. Agent, maintained plugins and Engine retain independent update executors; updates and restart require explicit confirmation. A completely unconfigured local Engine may be downloaded once by the native first-install coordinator, without inference or model downloads. Progress remains available in Settings. Prereleases default off. Ordinary browsers expose no desktop updater, and subscriptions are disposed with the plugin.

Capabilities opens with an action summary and three views: All, Needs attention and Update history. Compact two-column component cards fall back to one column inside a narrow Settings pane. Each card includes a description, installed and prepared/available versions, progress and component-specific actions. Plugin stages distinguish download, verification, preparation and the separately confirmed restart. Metadata-check errors request another check, not another install; failed Agent downloads permit an explicit same-version retry. A managed Engine update remains visible while running but cannot be installed until that Engine stops. Settings changes refresh metadata, never install components.

Startup confirmation returns the card to its current-version state instead of retaining a completion badge. History retains each plugin's most recent confirmed update or rollback, with versions and time; a prepared rollback shows its actual restore target. An older Engine Manager is an installation prerequisite, not an Engine installation failure. Identical native status echoes do not republish the same snapshot. The desktop file chooser uses the same locale, semantic palette and page primitives; directory reads are asynchronous and selection remains validated by the native owner.

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The General section has no built-in rows; each row appears only when its owning feature plugin is mounted.
