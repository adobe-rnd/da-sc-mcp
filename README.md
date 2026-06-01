# da-sc-mcp

A remote Model Context Protocol (MCP) server for DA Structured Content, deployed on Cloudflare Workers.

The server exposes schema compilation, validation, and serialization over Streamable HTTP, enabling MCP-aware clients to author and import DA Structured Content programmatically.

## Features

- **MCP tools** for compiling, validating, and serializing DA Structured Content
- **Remote deployment** on Cloudflare Workers
- **Streamable HTTP transport** — the modern MCP transport protocol
- **Stateless and auth-free** — persistence and authentication are delegated to DA admin tooling
- **Companion skills** for author, import, generate, serialize, validate, and editor-URL workflows

## Architecture

```text
┌─────────────────┐
│   MCP Client    │
└────────┬────────┘
         │ Streamable HTTP
         ↓
┌──────────────────────────────┐
│ da-sc-mcp (Cloudflare Worker)│
│  ┌────────────────────────┐  │
│  │ MCP Server (tools)     │  │
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
    ├── server.ts                     # Tool registration and schemas
    └── handlers.ts                   # Tool handlers and @adobe/da-sc-sdk calls

skills/
├── author-structured-content/
├── compute-editor-urls/
├── generate-schema/
├── import-structured-content/
├── serialize-structured-content/
└── validate-structured-content/

test/
├── mcp/handlers.integration.test.ts
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

| Skill                          | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `author-structured-content`    | End-to-end source → schema → document → optional DA persistence |
| `compute-editor-urls`          | Compute DA schema and document editor URLs from org/site/path   |
| `generate-schema`              | Schema-only workflow                                            |
| `import-structured-content`    | Existing-schema import with optional persistence                |
| `serialize-structured-content` | JSON → HTML serialization (no write by default)                 |
| `validate-structured-content`  | Validation for schemas and document data                        |

## Prerequisites

- Node.js 18 or later, with npm
- A Cloudflare account and the Wrangler CLI (for deployment)
- Claude Code — required only for MCP and skills usage

## Installation

```bash
git clone https://github.com/adobe-rnd/da-sc-mcp
cd da-sc-mcp
npm install
```

## Quick Start for Claude

For the simplest Claude MCP and skills setup, see [`CLAUDE-QUICK-START.md`](./CLAUDE-QUICK-START.md).

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

`npm run test` runs both mocked unit tests and real-SDK integration tests that verify MCP response-shape compatibility.

```bash
npm run test
npm run test:watch
npm run type-check
```

## Deployment

```bash
npm run deploy
```

After deployment, the MCP endpoint is available at:

```text
https://<your-worker-subdomain>.workers.dev/mcp
```

## Claude Setup (MCP and Skills)

Claude requires two things:

1. A `da-sc` MCP server configuration
2. Structured-content skills (recommended)

### 1. Configure the MCP Server

See the official [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp) for the full reference.

```bash
# Local scope (default): current project only
claude mcp add --transport http da-sc http://localhost:8787/mcp

# Project scope: shared via .mcp.json
claude mcp add --transport http da-sc --scope project http://localhost:8787/mcp

# User scope: available across all your projects
claude mcp add --scope user --transport http da-sc https://da-sc-mcp.adobeaem.workers.dev/mcp
```

Manage and inspect MCP servers:

```bash
claude mcp list
claude mcp get da-sc
claude mcp remove da-sc
```

From inside Claude Code:

```text
/mcp
```

### 2. Install Skills

Install from a local checkout:

```bash
# Preview available skills
npx skills add "/absolute/path/to/da-sc-mcp" --list

# Install all skills for all supported agents
npx skills add "/absolute/path/to/da-sc-mcp" --all
```

Install a single skill:

```bash
npx skills add "/absolute/path/to/da-sc-mcp" --skill serialize-structured-content
```

Verify installation:

```bash
npx skills ls --agent claude-code
```

Install directly from GitHub:

```bash
npx skills add "adobe-rnd/da-sc-mcp" --all
```

The `--all` flag installs every skill across every supported agent without interactive confirmation.

## Manual MCP Configuration (Optional)

To configure the server manually, add `da-sc` to `~/.claude.json` or your project's `.mcp.json`:

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

## Usage Examples

Once configured, you can ask Claude:

- "Compile this schema and list all issue pointers."
- "Validate this document data against the schema."
- "Serialize this document JSON to DA HTML."
- "Generate a schema and document from this source."

## API Endpoints

### `GET /health`

Returns the service status:

```json
{
  "status": "healthy",
  "service": "da-sc-mcp",
  "version": "0.1.0",
  "environment": "dev",
  "timestamp": "<ISO-8601 timestamp>"
}
```

### `POST /mcp`

The MCP protocol endpoint for tool execution.

### Other Request Behavior

- `OPTIONS /*` → CORS preflight (`204`)
- `GET /mcp` → `405 Method Not Allowed`

## Authentication

`da-sc-mcp` does not enforce authentication. This is intentional: the server is scoped to stateless structured-content operations. For authenticated DA persistence, use the DA admin MCP server alongside this one.

## Logging and Monitoring

Stream live worker logs:

```bash
wrangler tail
```

Use `/health` for uptime checks and `wrangler tail` for runtime diagnostics.

## License

Released under the Apache-2.0 license. See `package.json` for the SPDX identifier.
