# Specifian

A design-document management tool — like Storybook — where you write `.mdx` files under a local `.specs/` directory in Markdown and view or edit them in a Web UI. Because **front-matter is treated as structured design data**, it can be consumed via API or fed into code-generation templates.

🔎 **[Live demo](https://rabitarochan.github.io/specifian/)** — a static export of the example specs, running entirely in your browser.

## Features

- **MDX rendering & web editing** — View and edit MDX in `.specs/` through the Web UI, with live preview and automatic reload on external edits.
- **front-matter as a data API** — Each spec's YAML front-matter is structured design data, accessible from React components or via REST API.
- **Wiki links & graph visualization** — Link specs with `[[category:slug]]` and explore the link network interactively on the graph page.
- **Templates, schemas & guides** — `_template.mdx`, `_schema.json` (JSON Schema validation + auto-generated edit forms), and `_guide.md` (authoring conventions for humans and AI agents) per category.
- **Code generation** — Use spec data as input for scaffdog templates under `_generators/*.md`.
- **Custom components & diagrams** — Drop React components in `_components/*.tsx` (usable in any MDX without import), and render Mermaid diagrams and Excalidraw wireframes inline.
- **Full-text search** — Search title, description, front-matter, and body via the command palette (`Ctrl+K` / `Cmd+K`).
- **MCP server** — A built-in MCP server lets AI agents (e.g. Claude Code) safely read and write specs.
- **Static site export** — `specifian export` produces a fully static, server-less snapshot you can host anywhere, including a GitHub Pages subpath.

## Quick Start

```bash
# Install globally (or `npm install -D specifian` to add it to a project)
npm install -g specifian

# Create a .specs/ directory with sample content
specifian init

# Start the server (http://localhost:4400)
specifian serve
```

Open `http://localhost:4400` and confirm the sample specs are displayed. You can also run it via `npx specifian serve`.

## CLI Commands

| Command | Description |
|---|---|
| `specifian serve [--dir ./.specs] [--port 4400] [--open]` | Start the development server. |
| `specifian init [--dir ./.specs]` | Initialize `.specs/` from a template. |
| `specifian generate <generator> [--spec <id>] [--out .]` | Generate code from a scaffdog template. |
| `specifian validate [--dir ./.specs]` | Validate front-matter against `_schema.json` (exits 1 on violations). |
| `specifian export [--dir ./.specs] [--out dist-static]` | Export a read-only static site (no server needed). |
| `specifian mcp [--dir ./.specs]` | Start an MCP server (stdio) for AI agents. |
| `specifian agents [--out ./AGENTS.md]` | Generate an `AGENTS.md` that teaches AI agents how to use Specifian. |

See **[CLI & Static Site Export](./docs/cli-and-export.md)** for full options and examples.

## Documentation

- **[Concepts](./docs/concepts.md)** — `.specs/` directory structure, authoring guides, front-matter & components, and wiki links.
- **[CLI & Static Site Export](./docs/cli-and-export.md)** — All CLI commands and how to publish a static site.
- **[REST API](./docs/rest-api.md)** — Endpoints exposed by the server.
- **[MCP Server](./docs/mcp.md)** — Registering the server with Claude Code and the available tools.
- **[Design](./docs/DESIGN.md)** — Architecture and internals.

## Development

```bash
npm run dev      # Server (:4399) + Vite dev server (:5180), using examples/.specs
npm run build    # Build the CLI/server (tsup → dist/) and client (vite → dist/client/)
npm start        # Run the production build against examples/.specs
```

See [docs/DESIGN.md](./docs/DESIGN.md) for architecture details.

## Tech Stack

| Area | Technology |
|---|---|
| Language | TypeScript (strict mode), ESM |
| CLI | commander |
| Server | Express 5 + WebSocket (ws) + file watching (chokidar) + YAML parsing (gray-matter) |
| Client | React 19 + React Router 7 + Vite 8 |
| MDX | @mdx-js/mdx v3 + remark plugins |
| Editor | @uiw/react-codemirror |
| Graph visualization | d3-force |
| Code generation | @scaffdog/engine |

Node.js >= 20 required. Windows supported.

## License

MIT
