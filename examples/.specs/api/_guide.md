---
title: API — Authoring Guide
description: Conventions for writing REST API endpoint specs.
---

## Purpose

The `api/` category documents every REST endpoint (or logical endpoint group) the project exposes. Add a spec here whenever a new endpoint is introduced or the contract of an existing one changes. These specs are the reference for frontend developers, integrators, and automated agents.

## What to record

Every API spec front-matter must satisfy `api/_schema.json`. Required fields:

- `title` — Human-readable name (e.g. `"Users API"`)
- `description` — One sentence describing what the endpoint does
- `endpoint.method` — HTTP method: one of `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- `endpoint.path` — Full path starting with `/` (e.g. `/api/users`)
- `endpoint.description` — Sentence describing the operation
- `endpoint.params[]` — One entry per query parameter or request body field, each with:
  - `name` — Parameter name
  - `type` — Value type (e.g. `string`, `integer`, `boolean`)
  - `required` — `true` if the parameter is mandatory
  - `description` — What the parameter controls, including defaults (e.g. `"Page number (default: 1)"`)

In the MDX body, render the endpoint summary with `<DataView data={data.endpoint} />`. Include a **Request Example** section with a `bash` code block showing a sample `curl`/HTTP call. Include a **Response Example** section with a status-code table and JSON examples for at least the success and the primary error case (e.g. `401 Unauthorized`). Add a **Design Notes** section and a **Related Specs** section.

## Design conventions

- Follow **RESTful naming**: plural nouns for collections (`/api/users`), path parameters for individual resources (`/api/users/:id`).
- Document **all meaningful status codes**, not just `200`. At minimum cover `400`, `401`, and `500`.
- Always show an **error response body example** for `401` or `403` so callers know the error shape.
- Group closely related endpoints (list + create, or get + update + delete for the same resource) into a single spec when they share the same path prefix and front-matter fits one `endpoint` block. Split into separate specs only when the contracts diverge significantly.
- Use `<StatusBadge status="published" />` (or `draft` / `deprecated`) in the body to communicate lifecycle state.
- Authentication requirements (e.g. Bearer token) belong in **Design Notes**, not in `params`.

## Examples

- [[api:users-api]] — GET /api/users with pagination params, 200/401 response examples, and design notes
