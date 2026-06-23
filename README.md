# shiply — MCP server

[shiply](https://shiply.now) is instant web hosting for AI agents. An agent can
publish a live website in a single call — no account, no config — and then manage
the whole site over the same MCP server: updates, custom domains, SSL, environment
variables, site data, SQL databases, edge functions, lead capture, email, and a
marketplace to sell the site it built.

This repo is the public descriptor for the **hosted, remote** shiply MCP server.
There is nothing to install or run — you connect to the live endpoint.
Listed on the Official MCP Registry as **`now.shiply/shiply`**.

## Connect

**Remote MCP endpoint (Streamable HTTP):**

```
https://shiply.now/mcp
```

Add it to an MCP client (Claude Desktop, Cursor, Claude Code, etc.):

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
custom domains, databases, and analytics. Mint a key from the email-code flow in
[llms.txt](https://shiply.now/llms.txt).

## Tools

The live, authoritative tool list + JSON schemas are always at
[`/.well-known/mcp.json`](https://shiply.now/.well-known/mcp.json). By area:

- **Publish & versions** — `publish_site` (files → live `*.shiply.now` URL),
  update an existing site, `rollback`, `delete_site`
- **Status & verify** — `site_status`, `list_sites`, `verify_site` (status + SSL +
  thumbnail in one call)
- **Domains & SSL** — `add_domain`, `check_domain`, `set_handle` (vanity subdomain)
- **Config** — `set_variable` (encrypted per-user env), site access (password /
  invite-only)
- **Site Data** — read/write/export visitor records and collections
- **Databases** — per-site SQL: Cloudflare D1 and Neon Postgres (provision, query,
  branch)
- **Edge functions** — deploy serverless functions alongside the static site
- **Email & inbox** — `send_email`, `list_site_inbox`, `set_mailbox`, forward
- **Contracts** — create, send, and track e-sign contracts
- **Analytics** — `get_analytics` (views, referrers)

## Examples

Publish a folder, get a live URL (anonymous, no account):

```jsonc
// tool: publish_site
{ "files": [ { "path": "index.html", "content": "<h1>Hi</h1>" } ] }
// → { "url": "https://merry-maple-3kf2.shiply.now", "claimUrl": "..." }
```

Confirm it's live (status + SSL + screenshot) before reporting done:

```jsonc
// tool: verify_site
{ "slug": "merry-maple-3kf2" }
// → { "status": "LIVE", "ssl": { "valid": true }, "thumbnailUrl": "..." }
```

## Pricing

Flat **$0 / $8 / $24** — no usage meter, no surprise overage bill.
See https://shiply.now/pricing.

## Links

- Site: https://shiply.now
- Docs: https://shiply.now/docs
- Machine guide: https://shiply.now/llms.txt
- OpenAPI: https://shiply.now/openapi.json
- MCP metadata: https://shiply.now/.well-known/mcp.json
- Skill: [`shiply/SKILL.md`](shiply/SKILL.md) · install with `npx shiply-cli skill`
- Official MCP Registry: `now.shiply/shiply`

## License

MIT — see [LICENSE](LICENSE). (This repo is a metadata-only descriptor; the shiply
product source is not included.)
