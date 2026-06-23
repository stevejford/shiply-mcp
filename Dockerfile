# shiply is a hosted, remote MCP server — there is no local implementation to build.
# This image bridges a stdio MCP client to the live streamable-HTTP endpoint, so the
# server can be started and introspected locally (e.g. by Glama's checks, or by any
# stdio-only MCP client). It simply proxies to the public https://shiply.now/mcp.
FROM node:20-alpine
RUN npm install -g mcp-remote@latest
ENTRYPOINT ["mcp-remote", "https://shiply.now/mcp"]
