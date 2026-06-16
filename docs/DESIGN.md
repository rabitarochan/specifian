# specifian Design Document

A web tool that displays and edits `.mdx` files under a local `specs/` directory as documentation, similar to Storybook.
It treats front-matter as "structured design data" that can be referenced from React components and leveraged for API responses and code generation.

## Concept

- **Markdown (MDX) is the source of truth.** Managed with Git, editable in both VSCode and the Web UI.
- **front-matter = design data.** Accessible as `data` from the MDX body, retrievable in bulk via the API, and usable for code generation with scaffdog templates.
- **Applicable to any project.** The folder structure under `specs/` is completely free-form.

## Tech Stack

| Area | Technology |
|---|---|
| Language | TypeScript (strict), ESM (`"type": "module"`) |
| CLI | commander |
| Server | Express 4 + ws (WebSocket) + chokidar (file watching) + gray-matter |
| Client | React 18 + react-router-dom 6 + Vite 8 |
| MDX | @mdx-js/mdx v3 runtime evaluation (`evaluate`) + remark-gfm + remark-frontmatter + remark-mdx-frontmatter |
| Editor | @uiw/react-codemirror + @codemirror/lang-markdown |
| Graph | d3-force (SVG rendering via custom React components) |
| Code generation | @scaffdog/engine |
| Build | tsup (CLI/server → dist/), vite build (client → dist/client) |

Node >= 20. Windows support is required (paths are always normalized to `/` internally).

## Directory Structure (this repository)

```
specifian/
  package.json / tsconfig.json / tsup.config.ts / vite.config.ts
  docs/DESIGN.md
  src/
    shared/types.ts        # API contract & shared types (imported by both server and client)
    cli/index.ts           # bin entry point (serve / init / generate)
    server/                # Express server (owned by: server agent)
      app.ts               # createApp(specsDir): Express app + ws setup
      store.ts             # specs directory traversal, SpecMeta construction, and caching
      watcher.ts           # chokidar -> ws broadcast
      routes/              # API routes
      generate.ts          # code generation via scaffdog engine
      init.ts              # specifian init (copies examples/specs)
    client/                # React app (owned by: client agent)
      index.html
      main.tsx / App.tsx
      api.ts               # fetch wrapper (follows types.ts contract)
      ws.ts                # WebSocket subscription
      mdx/                 # MDX runtime compilation (evaluate + remark plugins)
      components/          # built-in components (TableDefinition, SpecList, ...)
      pages/               # Home / SpecPage / GraphPage
      styles/
  examples/specs/          # sample content (owned by: content agent; serves as both init template and dev fixture)
  README.md
```

## specs/ Rules (user's project side)

- Any folder at any depth under `specs/` = a **category** (e.g. `tables`, `api/v1`)
- `<category>/<slug>.mdx` = a **spec**. The ID is `<category>:<slug>` (e.g. `tables:users`)
- `<category>/_.mdx` = the category's **index page** (equivalent to index.html). slug is `_`
- `<category>/_template.mdx` = the **template** used when creating a new spec. Excluded from listings and the graph.
- `specs/_generators/*.md` = scaffdog-format **code generation templates** (not treated as specs)
- front-matter (YAML) follows a free schema. `title` and `description` are reserved keys interpreted by the UI.

## Wiki Links

- Syntax: `[[tables:users]]` or `[[tables:users|display name]]`
- `[[tables:users]]` → links to `specs/tables/users.mdx` (client route `/specs/tables/users`)
- `[[tables:_]]` can also link to a category index
- Extraction (server-side, for graph): regex `/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g`.
  Excludes matches inside code fences and inline code.
- Rendering (client-side): a remark plugin that traverses text nodes and replaces them with link elements.

## API Contract (`src/shared/types.ts` is authoritative)

Base: `http://localhost:<port>`. Categories can be nested, so wildcard routes are used.
All paths, categories, and IDs use `/` as the separator.

| Method / Path | Description |
|---|---|
| `GET /api/specs` | List all SpecMeta entries (excluding `_template`) |
| `GET /api/specs/<categoryPath>/<slug>` | Fetch one spec → `{ meta: SpecMeta, content: string }` (content is the raw text including front-matter) |
| `PUT /api/specs/<categoryPath>/<slug>` | Save with body `{ content: string }` → `{ meta }`. Returns 404 for non-existent paths. |
| `POST /api/specs` | body `{ category, slug, title? }`. Copies `<category>/_template.mdx` if it exists (replacing front-matter title); otherwise uses a minimal template. Returns 409 if already exists. |
| `POST /api/categories` | body `{ path }`. Creates a folder and generates a default `_.mdx` / `_template.mdx`. Returns 409 if already exists. |
| `GET /api/data` | `{ [category]: { [slug]: frontmatter } }` — all data (excluding `_template`, including `_`) |
| `GET /api/data/<categoryPath>` | `{ [slug]: frontmatter }` |
| `GET /api/graph` | `{ nodes: GraphNode[], edges: GraphEdge[] }` (built from wiki links; unresolvable link targets are included as nodes with `missing: true`) |
| `GET /api/generators` | List of available generator names |
| `POST /api/generate` | body `{ generator, specId?, out? }` → `{ files: { path, content }[] }` (also writes to disk when `out` is specified) |
| `WS /ws` | Broadcasts `{ type: 'fs', event: 'add'\|'change'\|'unlink', specId, path }` |

- Errors return `{ error: string }` with an appropriate status code.
- **Path traversal protection is required**: verify that the resolved absolute path is within specsDir.
- Writes use UTF-8 (no BOM); line endings respect the input.

### SpecMeta (shared type — see types.ts for details)

```ts
interface SpecMeta {
  id: string;        // "tables:users" / "tables:_" (category may contain "/": "api/v1:users")
  category: string;  // "tables", "api/v1"
  slug: string;      // "users", "_"
  path: string;      // "tables/users.mdx" (relative to specsDir, "/" separator)
  title: string;     // frontmatter.title ?? slug
  description?: string;
  data: Record<string, unknown>; // full front-matter object
  links: string[];   // spec IDs referenced by wiki links in the body
  isIndex: boolean;  // slug === "_"
}
```

## MDX Runtime (client)

- The `content` from `GET /api/specs/...` is compiled on the fly using `@mdx-js/mdx`'s `evaluate`.
- Remark plugins: remark-gfm → remark-frontmatter → remark-mdx-frontmatter (`name: "data"`) → wiki link plugin → **scope injection plugin** (injects `export const specs = <JSON>`, `export const category = "..."`, `export const slug = "..."` as mdxjs-esm nodes).
- This allows `data` (the spec's own front-matter), `specs` (all SpecMeta array), `category`, and `slug` to be used as bare identifiers in the MDX body.
- On compilation error, the app does not crash; instead it displays an error message panel (ErrorBoundary + try/catch).

### Built-in Components (no import needed inside MDX)

- `<TableDefinition data={...} />` — renders a DB table definition. `{ name, description?, columns: [{ name, type, nullable?, default?, primaryKey?, description? }] }`
- `<SpecList category="tables" />` — lists specs in a category (title / description / link). Defaults to the current category when `category` is omitted.
- `<DataView data={...} />` — formatted display of an object (collapsible JSON view).
- `<SpecLink to="tables:users">...</SpecLink>` — component version of a wiki link.
- Standard Markdown elements (table, code, blockquote, ...) also have styles applied.

## Client UI

Routing (BrowserRouter; the server falls back non-API paths to index.html):

- `/` — Home. Renders `_.mdx` at the specs root if it exists; otherwise shows a category list.
- `/specs/<categoryPath>` — Category index (`_.mdx` if present; otherwise an auto-generated listing).
- `/specs/<categoryPath>/<slug>` — Spec view.
- `/graph` — Link graph (d3-force; color-coded by category, draggable, click to navigate to a spec, missing nodes rendered with dashed borders).

Layout: Storybook-style. Left sidebar with a category tree (buttons to add folders/files), top title bar (view/edit toggle, link to graph), and a center content area.
Edit mode: Split view with CodeMirror on the left and live preview on the right (300ms debounce). Saves via Ctrl+S and a save button (PUT).
Receives `fs` events over WebSocket → re-fetches the tree. If the currently displayed file is changed externally: auto-reloads when there are no unsaved edits; shows a warning banner when edits are in progress.
UI is in English. Clean, modern color scheme (light theme, single accent color), plain CSS.

## CLI

```
specifian [serve] [--dir <specsDir>=./specs] [--port <port>=4400] [--open]
specifian init [--dir ./specs]          # copies bundled examples/specs to create a scaffold
specifian generate <generator> [--dir ./specs] [--spec <id>] [--out <dir>=.]
```

`serve` statically serves `dist/client`. `generate` renders `specs/_generators/<generator>.md` (scaffdog document format: front-matter + code fences with file names) using `@scaffdog/engine`. Template variables: `spec` (the target SpecMeta, where `spec.data` is the front-matter) and `specs` (all specs). When `--spec` is omitted, generation runs against all specs.

## Dev Scripts

- `npm run dev` — starts the server (tsx watch, port 4399, examples/specs) and Vite dev server (port 5180, proxying `/api` and `/ws` to 4399) concurrently.
- `npm run build` — tsup + vite build.
- `npm start` — starts the built output against examples/specs.

## v2 Feature Design

### User-Defined Components (`specs/_components/`)

- React components placed at `specs/_components/*.tsx` / `*.jsx` are available in all MDX files without an import.
- `GET /api/components` → `UserComponentFile[]` (path + source). `_components` is excluded from spec traversal.
- The client transpiles TSX → CJS using **sucrase** (bundle-split via dynamic import)
  (transforms: `typescript`, `jsx` (classic / React.createElement), `imports`),
  then executes with `new Function('require', 'module', 'exports', ...)`. The `require` shim resolves only `react`; any other import throws a clear error message.
- Component names: named exports use their export name; default exports use the PascalCase of the filename. When a name conflicts with a built-in, **the user-defined component takes precedence**.
- The watcher also notifies changes under `_components` via `FsEvent` (specId: null) → the client discards the compilation cache and re-renders.
- Compilation/runtime errors show an error panel without crashing the app.

### Full-Text Search

- `GET /api/search?q=<query>&limit=<n=20>` → `SearchResult[]`
- Fields and score order: title > description > front-matter (JSON-stringified) > body. Case-insensitive substring match (straightforward substring for languages like Japanese).
- UI: **Ctrl+K / Cmd+K** opens a command-palette-style modal. Incremental search with 150ms debounce, ↑↓ to select, Enter to navigate. Also places a search button at the top of the sidebar.

### Mermaid

- ` ```mermaid ` code fences are rendered as SVG by a `MermaidDiagram` component.
- The mermaid library is dynamically imported (split from the main bundle). Render errors show an error box.
- Hooked via the `code` renderer in the components map by detecting `language-mermaid`.

### front-matter Schema Validation

- Placing a `<category>/_schema.json` (JSON Schema) validates the front-matter of regular specs in that category (excluding the index `_` and `_template`) using **ajv** (allErrors).
- `GET /api/validation` → `ValidationReport`
- CLI: `specifian validate [--dir]` — lists violations and exits with code 1 if any are found (for CI integration).
- UI: warning badge on spec rows in the sidebar; violation list banner at the top of the spec page.

## v3 Feature Design: GUI Form Editing for front-matter

### Concept

Add a **[Text] / [Form]** tab to the left pane of edit mode.
The form is auto-generated from the category's `_schema.json` (JSON Schema); when no schema exists, a pseudo-schema is inferred from the current front-matter data.
The form only rewrites the YAML front-matter section. The body is edited in the [Text] tab.
**The single source of truth is the text being edited**: form change → YAML re-serialized → reflected back into the text (dirty state / Ctrl+S save / live preview all continue to work through the existing flow).

### Server

- `GET /api/schema/<categoryPath>` → `{ schema: <JSON> | null }` (null when no `_schema.json` exists; does not return 404).
- Refactor the schema lookup logic in validate.ts into a shared helper for reuse.

### Client (`src/client/form/`)

- `schemaTypes.ts` — structural types for the supported JSON Schema subset (fixed contract).
- `yamlSync.ts` — `splitFrontMatter(content)` / `replaceFrontMatter(content, data)`.
  Uses the `yaml` package for parse/stringify. Key order is stable (insertion order). YAML comments and custom formatting are normalized on form edit (documented as a known limitation in the README).
- `infer.ts` — `inferSchema(data)`: infers types from values when no schema is available (string/number/boolean/object/array).
- `SchemaForm.tsx` + field components — a schema-driven recursive form renderer:
  - string → text input (select if enum is present)
  - number / integer → numeric input; boolean → checkbox
  - object → nested fieldset (recursive)
  - **array of object → table UI with add / delete / reorder per row** (primary use case: editing table column definitions)
  - array of scalar → row list with add / delete
  - Schema `title` / `description` used for labels and help text; `required` fields marked with *.
  - Existing keys not in the schema are preserved and edited as "out-of-schema fields" via the inference form — they are never deleted.
- Validation: the client performs only lightweight required / type checks (full validation is handled server-side by the existing ajv ValidationProvider).

### SpecPage Integration

- Tabs [Text] [Form] at the top of the left pane in edit mode.
- Switching to the Form tab parses the current text. If the YAML is broken, an error message is shown and the Text tab is kept active.
- On every form change, `replaceFrontMatter` updates the text → the existing debounce preview follows.

## v4 Feature Design: Embedding Screen Designs with Excalidraw

### Concept

Create screen designs (wireframes) with **Excalidraw** (`@excalidraw/excalidraw`, MIT, fully local)
and manage them under the same `specs/` directory as sidecar files in Git.

### Storage

- `specs/<path>.excalidraw` — Excalidraw scene JSON (serializeAsJSON format). Excluded from spec traversal (only `.mdx` files are scanned, so these are naturally excluded).
- The watcher also broadcasts changes to `.excalidraw` files as `FsEvent` (specId: null).

### API

- `GET /api/drawings` → `DrawingMeta[]` (all `.excalidraw` files under specs, paths relative to specsDir using `/` separator)
- `GET /api/drawings/<path>` → the scene JSON as-is (404 if missing). `<path>` has no extension (`screens/login`)
- `PUT /api/drawings/<path>` → saves the body (scene JSON) to disk (new files can also be created; the parent folder must exist). Path traversal guard is required.
- Errors use `{ error }` format.

### Client

- Built-in MDX component `<Drawing src="screens/login" />` (src is specsDir-relative, no extension):
  - Fetches the scene and renders a **static SVG** via Excalidraw's `exportToSvg` (no editor is launched during view mode).
  - On hover, an "Edit" button appears → opens the Excalidraw editor in a **near-fullscreen modal** (langCode: "en").
  - Save → PUT → ws event → SVG re-renders. Cancel discards changes.
  - When no file exists, shows a placeholder + "Create drawing" button (PUTs an empty scene, then opens the editor).
  - External changes (e.g. from VSCode) trigger auto re-render via fs events.
- `@excalidraw/excalidraw` is **dynamically imported** and split from the main bundle (same pattern as mermaid).
- If Excalidraw requires it, add `define` entries (e.g. `process.env`) to vite.config as needed.

### Example

- `examples/specs/screens/` category: `_.mdx` / `_template.mdx` / `login.mdx` (front-matter with screen field definitions + `<Drawing src="screens/login" />`) / `login.excalidraw` (a simple wireframe of the login screen).

## v5 Feature Design: MCP Server / Lint API / Rename & Delete

### Concept

Enable AI agents to safely read and write specifian content (MCP + lint).
Also provide "document restructuring" operations (rename, delete) needed by both humans and agents.

### Shared Server Modules (used by both routes and MCP)

- `src/server/searchCore.ts` — `searchSpecs(specsDir, q, limit): Promise<SearchResult[]>` (extracts logic from routes/search.ts; the route becomes a thin wrapper).
- `src/server/lintCore.ts` — `lintContent(specsDir, req: LintRequest): Promise<LintIssue[]>`:
  1. YAML: gray-matter parse failure → error (rule: yaml)
  2. MDX syntax: `@mdx-js/mdx` `compile` (remark-gfm + remark-frontmatter) failure → error (rule: mdx, with line/column)
  3. Wiki links: `[[id]]` extracted from the body that cannot be resolved to an existing spec → warning (rule: wikilink)
  4. Schema: when a category is specified, validates front-matter against `_schema.json` using ajv → error (rule: schema)
- `src/server/specOps.ts` — `findRefs(specsDir, id)` / `renameSpec(specsDir, from, to)` / `deleteSpec(specsDir, id)`:
  - rename: renames the file (the target category must exist) + rewrites all `[[from]]` / `[[from|label]]` occurrences across all specs in bulk.
    **Does not rewrite occurrences inside code fences or inline code** (fence regions are excluded by position).
  - Pre-checks: from must exist (404) / to must not exist (409) / category must exist (400).

### API Additions and Changes

| Method / Path | Description |
|---|---|
| `POST /api/lint` | body `LintRequest { content, category?, slug? }` → `{ issues: LintIssue[] }` (does not save) |
| `PUT /api/specs/...` | Response extended to `SaveSpecResponse { meta, issues }` (save always proceeds; issues are informational) |
| `POST /api/rename` | body `{ from, to }` (spec IDs) → `{ meta, rewrittenFiles }` |
| `DELETE /api/specs/<categoryPath>/<slug>` | Delete a spec. `_.mdx` (`slug: _`) can also be deleted. |
| `GET /api/refs?id=<specId>` | `{ refs: string[] }` — list of spec IDs that reference the given ID |

### MCP Server (`specifian mcp [--dir ./specs]`)

- Uses `@modelcontextprotocol/sdk` stdio transport. **Do not write to stdout** (breaks the protocol) — log to stderr.
- Tools (input validated with zod schema; result as JSON string content):
  `list_specs` / `read_spec {id}` / `write_spec {id, content}` (existing specs only; returns issues) / `create_spec {category, slug, title?}` /
  `rename_spec {from, to}` / `delete_spec {id}` / `search {query, limit?}` / `get_data {category?}` /
  `validate` / `lint {content, category?}` / `list_generators` / `generate {generator, specId?, out?}`
- Each tool's description should be written with enough concrete detail that agents are not left guessing (e.g., explaining the ID format "category:slug").

### Client UI

- A hover "..." menu on spec rows in the sidebar → Rename / Delete.
  - Rename: enter a category (datalist) + slug → POST /api/rename → toast "Rewrote N link(s)". Navigates to the new route if the renamed spec is currently displayed.
  - Delete: GET /api/refs to show referencing specs ("Referenced by N spec(s)" + list) → confirm → DELETE. Navigates home if the deleted spec is currently displayed.
- On save: if `SaveSpecResponse.issues` is non-empty, display a list in an amber banner at the top of the page (consistent with the existing schema violation banner).

## Future Extensions (v6 candidates)

- Backlink panel, static site export (`specifian build`)
- Editor autocomplete (`[[` completion, front-matter key completion), image paste and save
- Full-text search indexing, Mermaid theme configuration, custom form widgets
- Drawing integration in the graph page, AGENTS.md generation (`specifian init`)
