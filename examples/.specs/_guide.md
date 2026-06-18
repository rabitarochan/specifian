---
title: Project — Authoring Guide
description: Project-wide conventions for writing and organizing specs in Specifian.
---

## Purpose

This guide covers the conventions that apply to every spec in the `.specs/` directory. Read this first, then read the guide for the specific category you are working in.

Specifian organizes design documents as MDX files under `.specs/`. Each subdirectory is a **category** (e.g. `tables/`, `api/`, `screens/`, `architecture/`). Every spec is a single `.mdx` file whose YAML front-matter is treated as structured design data and whose Markdown/JSX body is the human-readable document.

## What to record

Three reserved files give each category its contract:

| File | Role |
|---|---|
| `_guide.md` | Prose conventions for authors and AI agents — what to write, what to avoid, naming rules |
| `_template.mdx` | Skeleton used when creating a new spec via the UI or CLI |
| `_schema.json` | JSON Schema that validates the front-matter structure |

Every spec front-matter **must** include at least `title` and `description`. Additional top-level keys (e.g. `table`, `endpoint`, `screen`) are defined per category in `_schema.json`. All values in the front-matter are accessible inside the MDX body through the `data` variable.

## Design conventions

- **Wiki links** — Use `[[category:slug]]` to reference another spec. The slug is the filename without `.mdx`. Optionally supply display text: `[[api:users-api|Users API]]`. Links are visualized on the `/graph` page.
- **Front-matter is the source of truth** — Keep factual details (column types, HTTP methods, routes) in front-matter so they can be queried via the API. Use the Markdown body for prose, design rationale, and examples.
- **Category index (`_.mdx`)** — Each category has a `_.mdx` index that renders `<SpecList />`. Do not put per-spec details there.
- **Mermaid diagrams** — Render diagrams using fenced code blocks tagged `mermaid`. Prefer `graph TD` for flow diagrams and `erDiagram` for entity-relationship diagrams.
- **One concept per file** — Each spec documents one table, one endpoint group, one screen, or one architecture view.

## Examples

Category indexes to browse all specs in a category:

- [[tables:_]] — Database table definitions
- [[api:_]] — API specifications
- [[screens:_]] — Screen designs and wireframes
- [[architecture:_]] — System architecture diagrams
