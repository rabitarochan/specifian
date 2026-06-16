---
title: Tables — Authoring Guide
description: Conventions for writing database table definition specs.
---

## Purpose

The `tables/` category documents every database table used in the project. Add a spec here whenever a new table is created or an existing one changes significantly. These specs serve as the authoritative reference for schema design decisions and are linked from API and screen specs.

## What to record

Every table spec front-matter must satisfy `tables/_schema.json`. Required fields:

- `title` — Human-readable name (e.g. `"users table"`)
- `description` — One sentence describing what the table stores
- `table.name` — Exact table name as it appears in the database (snake\_case)
- `table.description` — Longer description of the table's role
- `table.columns[]` — One entry per column, each with:
  - `name` — Column name (snake\_case)
  - `type` — SQL data type (e.g. `bigint`, `varchar(255)`, `timestamp`, `boolean`)
  - `primaryKey` — `true` if this column is (part of) the primary key
  - `nullable` — `false` means NOT NULL; omit or set `true` for nullable columns
  - `default` — Default value expression as a string (e.g. `"'member'"`)
  - `description` — Short description of what the column stores

In the MDX body, render the table with `<TableDefinition data={data.table} />`. Add a **Design Notes** section explaining constraints, soft-delete policy, or application-level validation rules. Add a **Related Specs** section with wiki links.

## Design conventions

- Use **snake\_case** for both table names and column names.
- Every table must have a primary key column; mark it with `primaryKey: true`.
- Always include `created_at` and `updated_at` timestamp columns.
- Document unique constraints and foreign keys in the **Design Notes** section (the schema does not have a dedicated field for them).
- If a column has an enumerated set of valid values (e.g. `role: admin / moderator / member`), describe them in the column's `description` field.
- Prefer physical deletion over soft delete unless there is a documented reason; note the policy explicitly.

## Examples

- [[tables:users]] — Users table with role column, unique email constraint, and design notes
