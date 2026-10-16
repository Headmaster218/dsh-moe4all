# MoE4All Desktop Header Regions

The desktop host reclaims the native caption band and retains DWM caption buttons. Conversation, details and sidebar header roots expose stable `data-moe4all-drag` markers; the two rightmost headers expose `data-moe4all-caption` identities. The host injects drag/no-drag CSS and a DPI-aware right inset only in its WebView. Ordinary browser layouts do not change. Native controls and browser action must not cover page actions; interactive descendants remain clickable.

Validation uses the existing sidebar and conversation component specs, focused native shell geometry tests and a standalone browser layout fixture at 980/1380/1920px with details open/closed. No inference, full product build or release is required.
