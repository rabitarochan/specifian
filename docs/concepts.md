# Concepts

This page covers the core authoring concepts in Specifian: the `.specs/`
directory layout, authoring guides, front-matter and components, and wiki links.

## `.specs/` Directory Structure Rules

Understanding the file layout of `.specs/` is key to working with Specifian.

- **`.specs/<category>/`** — A category (folder). Nesting is supported (e.g., `.specs/api/v1/`).
- **`.specs/<category>/<slug>.mdx`** — A spec. Its ID is `<category>:<slug>` (e.g., `tables:users`).
- **`.specs/<category>/_.mdx`** — Category index. Displays the list of specs in that category and similar content.
- **`.specs/<category>/_template.mdx`** — Template. Automatically copied when a new spec is created.
- **`.specs/<category>/_guide.md`** — Authoring guide. Describes what to record in this category's specs and the design conventions, for both human authors and AI agents. Also `.specs/_guide.md` for project-wide guidance. (Not treated as a spec.)
- **`.specs/_generators/*.md`** — Code-generation templates in scaffdog format (not treated as specs).

### File Layout Example

```
.specs/
  _.mdx                          # Home page (root)
  _guide.md                      # Project-wide authoring guide
  tables/
    _.mdx                        # Index for the tables category
    _template.mdx                # Template for creating a new table spec
    _guide.md                    # Authoring guide for the tables category
    users.mdx                    # Users table definition
    posts.mdx                    # Posts table definition
  api/
    _.mdx                        # Index for the API category
    _template.mdx                # Template for creating a new API spec
    users-api.mdx                # Users API specification
  screens/
    _.mdx                        # Index for the screen design category
    _template.mdx                # Template for creating a new screen spec
    login.mdx                    # Login screen specification
    login.excalidraw             # Login screen wireframe
  _generators/
    typescript.md                # TypeScript type definition generation template
```

## Authoring Guides (`_guide.md`)

An authoring guide is a plain Markdown file named `_guide.md` that describes **what to record** in a category's specs and the **design conventions** that apply there. It is meant for human authors and AI agents alike.

### Root vs. per-category

| File | Scope |
|---|---|
| `.specs/_guide.md` | Project-wide guidance that applies to all categories. |
| `.specs/<category>/_guide.md` | Guidance specific to one category, complementing the root guide. |

### Recommended sections

```markdown
## Purpose
Why this category exists and what problems it solves.

## What to record
Which fields are mandatory, which are optional, and what each field means.

## Design conventions
Naming rules, relationship patterns, examples of good and bad entries.

## Examples
Links to representative specs in this category.
```

### Relationship to `_template.mdx` and `_schema.json`

| File | Role |
|---|---|
| `_template.mdx` | Skeleton MDX copied when a new spec is created. |
| `_schema.json` | JSON Schema that validates front-matter structure. |
| `_guide.md` | Prose guidance on intent, conventions, and examples. |

All three are complementary: the schema enforces structure, the template gives a starting shape, and the guide explains *why* and *how*.

### Creation

`_guide.md` is created automatically (with a placeholder) when a new category is created via the Web UI or MCP `create_spec`. You can also create it manually at any time.

### AI agent consumption

AI agents discover and read guides at runtime via MCP:

- **`list_guides`** — returns `{ category, hasGuide, hasSchema }[]` for the root and all categories. Use this first to understand the project structure.
- **`get_guide`** — returns the Markdown content of a guide (`{ guide, title?, description? }`). Omit `category` to get the root guide.

The `create_spec` tool also returns the relevant category guide in its response so agents have the conventions at hand when writing the new spec.

For an introduction to how to use these tools as an AI agent, run `specifian agents` to generate an `AGENTS.md` file (see [CLI & Export](./cli-and-export.md)).

## front-matter & Components

### Role of front-matter

The YAML front-matter in each `.mdx` file is the metadata for that design document.

```markdown
---
title: users table
description: User account information
table:
  name: users
  columns:
    - { name: id, type: bigint, primaryKey: true }
    - { name: email, type: varchar(255) }
---
```

front-matter is accessible inside MDX as the `data` variable. It can also be fetched in bulk via the REST API (`GET /api/data`).

### Variables Available in MDX

The following variables can be used directly in MDX body content:

- **`data`** — The spec's own front-matter object.
- **`specs`** — An array of `SpecMeta` for all specs.
- **`category`** — The spec's own category (string).
- **`slug`** — The spec's own slug (string).

### Built-in Components

Built-in components available in MDX without any import:

- **`<TableDefinition data={data.table} />`** — Renders a DB table definition. `data.table` has the shape `{ name, description?, columns: [...] }`.
- **`<SpecList category="tables" />`** — Displays a list of specs in a category. Defaults to the current category when `category` is omitted.
- **`<DataView data={...} />`** — Renders an object as a collapsible JSON view.
- **`<SpecLink to="tables:users">...</SpecLink>`** — Component version of a wiki link.
- **`<Drawing src="screens/login" />`** — Embeds an Excalidraw wireframe. Shows an edit button on hover; click to open a full-screen edit modal.

### User-defined Components

React components placed in `.specs/_components/*.tsx` are available in all MDX files without any import. You can even build interactive design screens using hooks like `useState`.

### Usage Example

```markdown
---
title: users table
table:
  name: users
  columns:
    - { name: id, type: bigint, primaryKey: true }
    - { name: email, type: varchar(255), nullable: false }
---

# {title}

A table for managing user information.

<TableDefinition data={data.table} />

## Related Specs

References the posts table via [[tables:posts]].
```

### Form Editing

Switch between the [Text] and [Form] tabs in the editor to edit YAML front-matter through a GUI form.
The schema's `title` is displayed as the form field label, and `description` as help text.
Fields with `enum` defined render as a dropdown.
Even without a `_schema.json` in the category, a form is generated by automatically inferring types from existing data.
Note that YAML comments and custom formatting are normalized when editing through the form.

## Wiki Links

Use `[[category:slug]]` wiki links to express relationships between specs.

### Link Syntax

```markdown
[[tables:users]]                    # Link to .specs/tables/users.mdx
[[tables:users|Users]]              # Specify custom display text
[[api:v1:users-api]]                # Nested categories are supported
[[tables:_]]                        # Links to the category index are also supported
```

### Graph Page

All specs and wiki links are automatically extracted and visualized as a link network on the graph page (`/graph`).

- **Draggable** — Drag nodes to reposition them.
- **Color-coded by category** — Visually distinguish categories at a glance.
- **Click to navigate** — Click a node to jump to that spec.
- **Missing nodes** — Specs whose link targets do not exist are shown with a dashed border.
