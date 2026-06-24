# Builds and runs the local shiply MCP server (stdio) — a real local server that
# calls shiply's public REST API directly. Glama generates its own Dockerfile from
# the admin config; this mirrors it for anyone building the repo directly.
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.mjs ./
ENV NODE_ENV=production
CMD ["node", "index.mjs"]
