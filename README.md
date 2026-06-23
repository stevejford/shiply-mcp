# shiply — MCP server

[shiply](https://shiply.now) is instant web hosting for AI agents. An agent can
publish a live website in a single call — no account, no config — and then manage
it over the same MCP server: updates, custom domains, SSL, environment variables,
site data, SQL databases, lead capture, and email.

This repo is the public descriptor for the **hosted, remote** shiply MCP server.
There's nothing to install or run — you connect to the live endpoint.

## Connect

**Remote MCP endpoint (Streamable HTTP):**

```
https://shiply.now/mcp
```

Add it to an MCP client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "shiply": {
      "url": "https://shiply.now/mcp"
    }
  }
}
```

## Auth

Auth is **optional**. `publish_site` works anonymously — anonymous sites go live
instantly and can be claimed into an account later. Pass a Bearer API key
(`Authorization: Bearer shp_…`) to manage owned sites and unlock variables,
custom domains, databases, and analytics. Mint a key from the email-code flow
described in [llms.txt](https://shiply.now/llms.txt).

## Tools

- `publish_site` — put files on the web, get a live `*.shiply.now` URL
- `site_status`, `list_sites`, `verify_site`, `rollback`, `delete_site`
- `set_handle`, `set_variable`, `add_domain`, `check_domain`
- `get_analytics`, site data, per-site SQL databases (Cloudflare D1 + Neon)
- agent email / inbox, contracts

The live tool list and schemas are always at
[`/.well-known/mcp.json`](https://shiply.now/.well-known/mcp.json).

## Links

- Site: https://shiply.now
- Docs: https://shiply.now/docs
- Machine guide: https://shiply.now/llms.txt
- OpenAPI: https://shiply.now/openapi.json
- MCP metadata: https://shiply.now/.well-known/mcp.json
- Listed on the Official MCP Registry as `now.shiply/shiply`
