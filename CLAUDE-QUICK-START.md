# Claude Quick Start

Paste the prompt below into Claude (Desktop or Code). Claude will install the skills and MCP servers for you — no CLI required.

## You need

- [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.com/claude-code)

## The prompt

Copy this and paste it into a new Claude conversation:

```
Please set up the DA Structured Content tooling for me:

1. Install the skills from this GitHub repo: https://github.com/adobe-rnd/da-sc-mcp/tree/main/skills

2. Add these two MCP servers (both HTTP transport, user scope):
   - name: `da`, URL: https://mcp.adobeaemcloud.com/adobe/mcp/da
   - name: `da-sc`, URL: https://da-sc-mcp.adobeaem.workers.dev/mcp

3. Confirm both are installed, then tell me what I can try first.
```

## After setup

Ask Claude things like:

- "Create a demo structured content for blog posts in org=acme site=blog"
- "Take this JSON and create it as structured content in org=acme site=catalog"
- "Convert this JSON to structured content HTML"
- "Validate this schema"

Claude picks the right skill automatically. If anything doesn't work, just describe what you saw to Claude — it can troubleshoot with you.
