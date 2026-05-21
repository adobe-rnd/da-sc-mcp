# Non-developer setup (Claude only)

Use this guide if you only want to use `da-sc-mcp` in Claude and do not need local development.

## 1) Add the MCP server (user scope)

```bash
claude mcp add --scope user --transport http da-sc https://da-sc-mcp.adobeaem.workers.dev/mcp
```

## 2) Install the Structured Content skills

```bash
npx skills add "adobe-rnd/da-sc-mcp" --all
```

## 3) Verify setup

```bash
claude mcp get da-sc
npx skills ls --agent claude-code
```

## 4) Use in Claude Code

In Claude Code, run:

```text
/mcp
```

You should see `da-sc` and its `sc_*` tools available.
