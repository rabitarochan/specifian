/**
 * agents.ts — generates a static AGENTS.md that teaches AI agents (e.g. Claude Code)
 * how to work with a Specifian project via its MCP server.
 *
 * Deliberately STATIC: it does NOT enumerate the current categories. Instead it
 * instructs the agent to discover the live structure at runtime through the MCP
 * tools (`list_guides`, `get_guide`). That way the file never goes stale when
 * categories are added or removed — regenerate it only when upgrading Specifian.
 */

/** Build the AGENTS.md contents. Pure/static — safe to call without a specs dir. */
export function generateAgentsDoc(): string {
  return `# Working with Specifian

This project stores its design documents as MDX "specs" under \`.specs/\`, managed by
[Specifian](https://github.com/rabitarochan/specifian). Specifian ships an MCP server
that lets you (an AI agent) read and write these specs safely. **Prefer the MCP tools
over editing files directly** — they keep wiki links, schemas, and metadata consistent.

## Setup (one time)

Register the MCP server in \`.mcp.json\` (or your MCP client configuration):

\`\`\`json
{
  "mcpServers": {
    "specifian": {
      "command": "npx",
      "args": ["specifian", "mcp", "--dir", "./.specs"]
    }
  }
}
\`\`\`

## Key concepts

- A **spec** is one \`.mdx\` file. Its **ID** is \`"<category>:<slug>"\` (e.g. \`tables:users\`;
  a category index is \`tables:_\`). Categories may nest with \`/\` (e.g. \`api/v1:users\`).
- **front-matter** (YAML at the top of each spec) is treated as structured design data.
- Reserved per-category files (not regular specs):
  - \`_.mdx\` — category index page.
  - \`_template.mdx\` — skeleton copied when a new spec is created.
  - \`_schema.json\` — JSON Schema that constrains the front-matter (the structural contract).
  - \`_guide.md\` — **authoring guide**: prose describing *what to record* in this category
    and the *design conventions* to follow. A root \`.specs/_guide.md\` holds project-wide guidance.

## Discover the structure at runtime

Do not assume which categories exist — they change over time. Always discover them live:

1. Call **\`list_guides\`** → \`{ category, hasGuide, hasSchema }[]\` to see the current
   categories (including the root \`""\`) and which have a guide and/or schema.
2. Call **\`get_guide\`** with no argument to read the **root** guide, then with the target
   \`category\` to read that category's guide. Follow their conventions.

## Authoring workflow

When creating or editing a spec:

1. \`list_guides\` — find the right category (or confirm one needs to be created).
2. \`get_guide\` (root, then category) — learn what to record and the conventions.
3. If the category has a schema, review it (it is also returned by \`validate\`/\`lint\` errors).
4. \`create_spec { category, slug, title? }\` for a new spec (it returns the category guide
   in its response), or \`read_spec\` + \`write_spec { id, content }\` to edit an existing one.
5. \`lint { content, category, slug }\` before/after writing to catch YAML, MDX, wiki-link,
   and schema problems.
6. \`validate\` to check front-matter across the whole project against the schemas.

## Other useful tools

- \`list_specs\` / \`read_spec\` — browse existing specs.
- \`search { query }\` — full-text search.
- \`get_refs { id }\` — find specs that link to a given spec (check impact before renaming/deleting).
- \`rename_spec { from, to }\` — rename and rewrite all wiki links.
- \`get_data { category? }\` — fetch front-matter in bulk.
- \`list_generators\` / \`generate\` — run scaffdog code generators.

> This file is static. The list of categories and their guides is intentionally **not**
> baked in here — discover it at runtime with \`list_guides\` / \`get_guide\`. Regenerate this
> file with \`specifian agents\` only when upgrading Specifian.
`;
}
