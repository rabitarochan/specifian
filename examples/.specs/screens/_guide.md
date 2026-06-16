---
title: Screens — Authoring Guide
description: Conventions for writing screen design and wireframe specs.
---

## Purpose

The `screens/` category documents every distinct screen (page or modal) in the application UI. Add a spec here when designing a new screen or when the layout, fields, or behavior of an existing screen changes. These specs connect wireframes to table and API specs, giving engineers and designers a single source of truth per screen.

## What to record

Every screen spec front-matter should include:

- `title` — Human-readable screen name (e.g. `"Login Screen"`)
- `description` — One sentence describing the screen's role
- `screen.route` — URL path for the screen (e.g. `/login`)
- `screen.fields[]` — One entry per input field, each with:
  - `name` — Field label as shown in the UI (e.g. `Email`)
  - `type` — Input type (e.g. `email`, `password`, `text`, `select`, `checkbox`)
  - `required` — `true` if the field must be filled before submitting
  - `description` — Purpose or validation hint for the field
- `screen.actions[]` — One entry per user action (button, link), each with:
  - `name` — Button or link label
  - `description` — What happens when triggered

In the MDX body, embed the Excalidraw wireframe with `<Drawing src="screens/<slug>" />` where `<slug>` matches the spec filename. Render fields with `<DataView data={data.screen.fields} />` and actions with `<DataView data={data.screen.actions} />`. Add a **Behavior** section listing validation rules, error messages, and edge-case handling. Add a **Related Specs** section with wiki links to the relevant tables and APIs.

## Design conventions

- The `<Drawing>` `src` value must exactly match `screens/<slug>` (no `.mdx` extension). Keep Excalidraw source files in the same `screens/` asset folder.
- List **all user-visible input fields** in `screen.fields`, including hidden fields that influence behavior (e.g. a CSRF token).
- List **every interactive action** in `screen.actions`, including secondary links (e.g. "Go to Password Reset").
- Describe validation and error feedback in the **Behavior** section, not in front-matter.
- One spec per screen. Shared components (navigation bar, footer) do not need their own spec unless they have complex behavior.

## Examples

- [[screens:login]] — Login screen with email/password fields, two actions, validation rules, and a wireframe
