# MCP Server

Specifian includes a built-in MCP (Model Context Protocol) server, allowing AI agents (such as Claude Code) to
safely read and write spec documents. It operates over stdio transport.

## Starting the Server

```bash
specifian mcp --dir ./.specs
```

> Because stdout is reserved for the MCP protocol (JSON-RPC), all logs are written to stderr.

## Registering with Claude Code

Add the following to `.mcp.json` (or your Claude Code MCP configuration).

```json
{
  "mcpServers": {
    "specifian": {
      "command": "npx",
      "args": ["specifian", "mcp", "--dir", "./.specs"]
    }
  }
}
```

You can also run `specifian agents --out ./AGENTS.md` to generate an `AGENTS.md`
that teaches agents how to register this server and discover project conventions
at runtime.

## Available Tools

All spec IDs use the `"category:slug"` format (the index is `tables:_`). `content` is the full MDX text including front-matter.

| Tool | Description |
|---|---|
| `list_specs` | Returns metadata (`SpecMeta[]`) for all specs (excluding `_template`). |
| `read_spec` | `{ id }` → `{ meta, content }`. Returns an error if the spec does not exist. |
| `write_spec` | Overwrites an existing spec with `{ id, content }` and returns `{ meta, issues }`. |
| `create_spec` | Creates a new spec with `{ category, slug, title? }`. Copies `_template.mdx` if present. |
| `rename_spec` | Renames a spec with `{ from, to }` and rewrites all wiki links. Returns `{ meta, rewrittenFiles }`. |
| `delete_spec` | Deletes a spec with `{ id }`. Returns `{ ok, brokenRefs }` to report broken references. |
| `get_refs` | `{ id }` → `{ refs }`. Returns a list of spec IDs that reference the given ID. |
| `search` | `{ query, limit? }` → `SearchResult[]`. Full-text search. |
| `get_data` | `{ category? }` → front-matter data map. |
| `validate` | Validates front-matter against `_schema.json` and returns a `ValidationReport`. |
| `lint` | Validates `{ content, category?, slug? }` without saving and returns `{ issues }`. |
| `list_generators` | Returns a list of available code-generation template names (`string[]`). |
| `generate` | Generates code with `{ generator, specId?, out? }` and returns `{ files }`. |
| `get_guide` | `{ category? }` → `{ guide, title?, description? }`. Returns the category's `_guide.md` Markdown (root guide when `category` is omitted). |
| `list_guides` | Returns `{ category, hasGuide, hasSchema }[]` for the root and all categories — lets agents discover the project structure. |
