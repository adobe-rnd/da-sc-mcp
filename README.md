# da-sc-mcp

A remote Model Context Protocol (MCP) server for DA Structured Content on Cloudflare Workers.

This server exposes DA Structured Content schema/document operations over Streamable HTTP so LLM clients (Claude, Cursor, etc.) can compile, validate, and serialize structured content.

## Features

- **4 Structured Content tools**: compile, validate, serialize schema, serialize document
- **Remote access**: deployable on Cloudflare Workers
- **Streamable HTTP transport**: modern MCP transport protocol
- **No auth in this server**: intentionally auth-free; persistence/auth flows are handled by DA admin tooling
- **Companion skills included**: author/import/generate/serialize/validate/editor-URL workflows

## Architecture

```text
┌─────────────────┐
│   MCP Client    │
│ (Claude/Cursor) │
└────────┬────────┘
         │ Streamable HTTP
         ↓
┌──────────────────────────────┐
│ da-sc-mcp (Cloudflare Worker)│
│  ┌────────────────────────┐  │
│  │ MCP Server (4 tools)   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ @adobe/da-sc-sdk       │  │
│  │ schema/data/html APIs  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## Project Structure

```text
src/
├── index.ts                          # Worker entry point + MCP transport
└── mcp/
    ├── server.ts                     # Tool registration/schemas
    └── handlers.ts                   # Tool handlers + direct @adobe/da-sc-sdk calls

skills/
├── author-structured-content/
├── generate-schema/
├── import-structured-content/
├── serialize-structured-content/
├── validate-structured-content/
└── compute-editor-urls/

test/
└── mcp/handlers.test.ts

CLAUDE-QUICK-START.md
README.md
package.json
wrangler.toml
```

## Available MCP Tools

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `sc_compile_schema`     | Compile schema against DA form constraints and return `editable` + `issues` |
| `sc_validate_document`  | Validate document `data` against schema and return pointer-based errors     |
| `sc_serialize_schema`   | Convert schema JSON into DA schema-editor HTML shell                        |
| `sc_serialize_document` | Convert `{ metadata, data }` document JSON into DA EDS HTML                 |

## Included Skills

| Skill                          | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `author-structured-content`    | End-to-end source -> schema -> document -> optional DA persistence |
| `compute-editor-urls`          | Compute DA schema/document editor URLs from org/site/path          |
| `generate-schema`              | Schema-only workflow                                               |
| `import-structured-content`    | Existing-schema import + optional persistence                      |
| `serialize-structured-content` | JSON -> HTML serialization-only workflow (no write by default)     |
| `validate-structured-content`  | Validation-only workflow for schema and/or document data           |

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account + Wrangler CLI (for deployment)
- Claude Code (optional, for MCP + skills usage)

## Installation

```bash
git clone https://github.com/adobe-rnd/da-sc-mcp
cd da-sc-mcp
npm install
```

## Claude-Only Quick Start

For the simplest Claude MCP + skills setup, see:

- [`CLAUDE-QUICK-START.md`](./CLAUDE-QUICK-START.md)

## Development

### Local Development

```bash
npm run dev
```

Endpoints:

- **Health**: `http://localhost:8787/health`
- **MCP**: `http://localhost:8787/mcp`

Recommended client header:

- `Accept: application/json, text/event-stream`

### Testing

`npm run test` includes both mocked unit tests and real-SDK integration tests that verify MCP response shape compatibility.

```bash
npm run test
npm run test:watch
npm run type-check
```

## Deployment

```bash
npm run deploy
```

After deploy, MCP endpoint format:

- `https://<your-worker-subdomain>.workers.dev/mcp`

## Claude Setup (MCP + skills)

Claude needs two things:

1. `da-sc` MCP server configuration
2. Structured-content skills installation (recommended)

### 1) Configure MCP without editing JSON manually

Official docs: [Claude Code MCP](https://code.claude.com/docs/en/mcp)

```bash
# Local scope (default): current project only
claude mcp add --transport http da-sc http://localhost:8787/mcp

# Project scope: shared in .mcp.json
claude mcp add --transport http da-sc --scope project http://localhost:8787/mcp

# User scope: available across your projects
claude mcp add --scope user --transport http da-sc https://da-sc-mcp.adobeaem.workers.dev/mcp
```

Manage/check MCP servers:

```bash
claude mcp list
claude mcp get da-sc
claude mcp remove da-sc
```

Inside Claude Code:

```text
/mcp
```

### 2) Install skills

Install from local checkout:

```bash
# Preview
npx skills add "/absolute/path/to/da-sc-mcp" --list

# Install all skills for all supported agents
npx skills add "/absolute/path/to/da-sc-mcp" --all
```

Install a single skill:

```bash
npx skills add "/absolute/path/to/da-sc-mcp" --skill serialize-structured-content
```

Verify:

```bash
npx skills ls --agent claude-code
```

Install directly from GitHub (after repo has content):

```bash
npx skills add "adobe-rnd/da-sc-mcp" --all
```

### What `npx skills add adobe/skills --all` means

- `skills add`: install skills from a source (GitHub repo or local path)
- `adobe/skills`: GitHub source repository
- `--all`: shorthand for all skills + all agents + non-interactive confirmation

Equivalent pattern for this project:

```bash
npx skills add "adobe-rnd/da-sc-mcp" --all
```

## Optional manual Claude MCP configuration

If you prefer manual config, set `da-sc` in `~/.claude.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "da-sc": {
      "type": "http",
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

## adobeUsage examples

Examples you can ask Claude once configured:

- "Compile this schema and tell me all issue pointers"
- "Validate this document data against the schema"
- "Serialize this document JSON to DA HTML only"
- "Generate schema + document for this source"

## API Endpoints

### `GET /health`

Returns service status:

```json
{
  "status": "healthy",
  "service": "da-sc-mcp",
  "version": "0.1.0",
  "environment": "dev",
  "timestamp": "2026-05-20T12:00:00.000Z"
}
```

### `POST /mcp`

MCP protocol endpoint for tool execution.

### Other request behavior

- `OPTIONS /*` -> CORS preflight (`204`)
- `GET /mcp` -> `405 Method Not Allowed`

## Authentication model

`da-sc-mcp` itself does not enforce auth.

This is intentional for the structured-content-only workflow. If you need authenticated DA persistence operations, use the DA admin MCP flow alongside this server.

## Logging and Monitoring

```bash
wrangler tail
```

Use `/health` for uptime checks and Wrangler logs for runtime diagnostics.
