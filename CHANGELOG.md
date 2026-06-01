# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases from this point forward are produced by [semantic-release](https://github.com/semantic-release/semantic-release) and appended above this entry.

## [0.1.0] - 2026-06-01

Initial release of the remote MCP server for DA Structured Content on Cloudflare Workers.

### Added

- MCP server over Streamable HTTP exposing four tools backed by `@adobe/da-sc-sdk`:
  - `sc_compile_schema` — compile a schema against DA form constraints
  - `sc_validate_document` — validate document data against a schema
  - `sc_serialize_schema` — convert schema JSON into DA schema-editor HTML
  - `sc_serialize_document` — convert document JSON into DA EDS HTML
- `GET /health` endpoint and CORS handling for `OPTIONS /*`.
- Cloudflare Workers deployment via Wrangler, with `dev`, `deploy`, `deploy:ci`, and `deploy:production` scripts.
- Companion skills: `author-structured-content`, `compute-editor-urls`, `generate-schema`, `import-structured-content`, `serialize-structured-content`, `validate-structured-content`.
- Vitest unit tests and real-SDK integration tests covering MCP response shapes.
- semantic-release pipeline with changelog, git, and exec plugins driving versioned Wrangler deploys.
