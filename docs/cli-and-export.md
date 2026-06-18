# CLI & Static Site Export

## CLI Commands

| Command | Description |
|---|---|
| `specifian serve [--dir ./.specs] [--port 4400] [--open]` | Start the development server. `--open` automatically opens a browser. |
| `specifian init [--dir ./.specs]` | Initialize `.specs/` from a template. |
| `specifian generate <generator> [--dir ./.specs] [--spec <id>] [--out .]` | Generate code from a scaffdog template. |
| `specifian validate [--dir ./.specs]` | Validate front-matter against `_schema.json`. Exits with code 1 on violations. |
| `specifian export [--dir ./.specs] [--out dist-static]` | Export a read-only static site (no server needed). See [Static Site Export](#static-site-export). |
| `specifian mcp [--dir ./.specs]` | Start an MCP server (stdio) so AI agents can read and write specs. See [MCP Server](./mcp.md). |
| `specifian agents [--out ./AGENTS.md]` | Generate an `AGENTS.md` that teaches AI agents (Claude Code) how to use Specifian: register the MCP server, then at runtime discover categories via `list_guides` and read guides via `get_guide` before authoring. |

### Everyday usage examples

```bash
# Start the server with a custom specs directory and port
specifian serve --dir ./.specs --port 4400

# Generate code from a code-generation template
specifian generate typescript-interface --out ./src/generated

# Validate front-matter against schemas for CI (exits with code 1 on violations)
specifian validate --dir ./.specs

# Export a read-only static site (host on GitHub Pages, etc.)
specifian export --dir ./.specs --out ./dist-static

# Generate AGENTS.md so AI agents know how to use Specifian in this project
specifian agents --out ./AGENTS.md
```

The generated `AGENTS.md` is a **static** how-to: it explains how to register the MCP server and instructs agents to call `list_guides` / `get_guide` at runtime to discover categories and read conventions. Because category discovery happens at runtime via MCP, you do **not** need to regenerate `AGENTS.md` when you add new categories.

## Static Site Export

`specifian export` writes a **read-only snapshot** of your specs as a fully static
site that needs no server at runtime. It is ideal for publishing your design docs
to GitHub Pages, Netlify, an S3 bucket, or any static host.

```bash
# Build once, then export (the export reuses the prebuilt client, so a build is required)
specifian export --dir ./.specs --out ./dist-static

# Preview locally with any static server
npx serve ./dist-static
```

| Option | Default | Description |
|---|---|---|
| `--dir <specsDir>` | `./.specs` | Specs directory to snapshot. |
| `--out <outDir>` | `dist-static` | Output directory (created/emptied on each run). |

### What works in the static site

Everything needed to **read** the specs runs in the browser: MDX rendering,
Mermaid and Excalidraw diagrams, wiki links and the graph page, user-defined
components (`_components/*.tsx`), authoring guides, and full-text search (a search
index is baked at export time). All `GET` API responses are pre-generated as JSON
under `<outDir>/data/`.

### What is excluded

Server-only features are intentionally omitted from the snapshot: creating /
editing / deleting / renaming specs, the WebSocket file watcher, lint-on-save,
code generation, and the MCP server. The editing UI is hidden in the static build.

### Hosting on a subpath (e.g. GitHub Pages)

No configuration is required. The build uses a relative asset base and
`HashRouter`, so the same output works whether it is served from the domain root
or a subpath such as `https://<user>.github.io/<repo>/`. URLs look like
`…/#/specs/tables/users`, matching the routes used by `specifian serve`.
