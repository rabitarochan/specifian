# REST API

The API provided by the Specifian server. All paths are relative to the base URL (e.g., `http://localhost:4400`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/specs` | List all spec `SpecMeta` entries (excluding `_template`). |
| `GET` | `/api/specs/<category>/<slug>` | Fetch a single spec (metadata + raw text). |
| `PUT` | `/api/specs/<category>/<slug>` | Save a spec (body: `{ content: string }`). |
| `POST` | `/api/specs` | Create a new spec (body: `{ category, slug, title? }`). |
| `POST` | `/api/categories` | Create a new category (body: `{ path }`). |
| `GET` | `/api/data` | All specs' front-matter data (grouped by category). |
| `GET` | `/api/data/<category>` | front-matter data for a specific category. |
| `GET` | `/api/graph` | Graph data (nodes & edges) built from wiki links. |
| `GET` | `/api/generators` | List of available code-generation template names. |
| `POST` | `/api/generate` | Generate code (body: `{ generator, specId?, out? }`). |
| `GET` | `/api/drawings` | List all Excalidraw files. |
| `GET` | `/api/drawings/<path>` | Fetch an Excalidraw scene JSON (path without extension). |
| `PUT` | `/api/drawings/<path>` | Save an Excalidraw scene JSON. |
| `WS` | `/ws` | WebSocket. Broadcasts file-change events. |

## Error Responses

All errors are returned in `{ error: string }` format with an appropriate HTTP status code.

```json
{
  "error": "Spec not found"
}
```
