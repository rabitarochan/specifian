---
title: Architecture — Authoring Guide
description: Conventions for writing system architecture and design diagram specs.
---

## Purpose

The `architecture/` category documents the system-level structure of the project: tier layouts, component relationships, ER diagrams, data-flow diagrams, and major design decisions. Add a spec here when introducing a new subsystem, changing the layer structure, or when a diagram would communicate something that prose alone cannot.

## What to record

Architecture specs are more free-form than tables or API specs — there is no dedicated `_schema.json` for this category. Front-matter should include at minimum:

- `title` — Descriptive name for the view being documented (e.g. `"System Architecture Diagram"`)
- `description` — One sentence explaining what this diagram shows

In the MDX body, use **Mermaid** fenced code blocks for diagrams. Common diagram types:

- `graph TD` — Top-down flow diagrams for system tiers, deployment topology, or request flow
- `erDiagram` — Entity-relationship diagrams showing table relationships (primary/foreign keys, cardinality)
- `sequenceDiagram` — Sequence diagrams for request/response flows between services

Follow each diagram with a short prose section explaining the components and their interactions. Add a **Related Specs** section linking to the tables, APIs, or screens the diagram references.

## Design conventions

- **One concern per spec** — Separate the system-tier diagram from the ER diagram into different files if they would otherwise make a single spec unwieldy. Use wiki links to connect them.
- Label Mermaid nodes clearly: include both the component name and its technology in quotes (e.g. `"API Server<br/>(Express)"`).
- For ER diagrams, annotate primary keys with `PK` and foreign keys with `FK` inside the entity block, and label relationships (e.g. `"posts"`).
- Describe **design decisions** (why a three-tier layout, why PostgreSQL) in prose — diagrams show structure, not rationale.
- Link every table referenced in an ER diagram back to its `[[tables:slug]]` spec. Link every API referenced in a flow diagram to its `[[api:slug]]` spec.
- Keep diagrams at the right level of abstraction: system diagrams omit implementation details; component diagrams can go deeper.

## Examples

- [[architecture:overview]] — Three-tier system diagram and ER diagram with cross-links to table and API specs
