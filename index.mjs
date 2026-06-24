#!/usr/bin/env node
/**
 * shiply MCP server (local / stdio).
 *
 * A standalone Model Context Protocol server that lets an agent publish websites
 * to shiply.now and manage them. It is a real local server — it calls shiply's
 * PUBLIC REST API (https://shiply.now/api/v1/*) directly, it does not proxy to a
 * hosted MCP endpoint. No account is needed to start: anonymous publishes work
 * out of the box and return a live URL you can claim to keep.
 *
 * Auth: set SHIPLY_API_KEY (shp_…) for owned-site operations, or pass `apiKey`
 * to individual tools. Override the base with SHIPLY_API_BASE for testing.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { z } from 'zod'

const BASE = process.env.SHIPLY_API_BASE ?? 'https://shiply.now'
const ENV_KEY = process.env.SHIPLY_API_KEY

const CONTENT_TYPES = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain', md: 'text/markdown',
  xml: 'application/xml', wasm: 'application/wasm', woff: 'font/woff', woff2: 'font/woff2',
}
function contentTypeFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/** Call the shiply REST API. Throws a readable error on non-2xx. */
async function api(method, path, body, apiKey) {
  const key = apiKey || ENV_KEY
  const headers = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers.authorization = `Bearer ${key}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text || `HTTP ${res.status}`
    throw new Error(`shiply ${method} ${path} failed (${res.status}): ${msg}`)
  }
  return json
}

/** Recursively list files under a directory. */
function walk(root) {
  const out = []
  for (const name of readdirSync(root)) {
    const abs = join(root, name)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs))
    else out.push(abs)
  }
  return out
}

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })

const server = new McpServer({ name: 'shiply', version: '1.0.0' })

server.registerTool(
  'publish_site',
  {
    title: 'Publish a site',
    description:
      'Publish a website to shiply.now and get back a live URL — in one call, no account needed to start. ' +
      'Pass `files` (inline) or a local `dir`. Anonymous sites go live instantly and last 24 hours; the ' +
      'response includes a claimUrl to keep the site forever on a free account. NEVER create a new site to ' +
      'update an existing one — re-publish to the SAME site by passing its `claimToken` (anonymous) or `slug` ' +
      '(owned, requires an API key).',
    inputSchema: {
      files: z
        .array(z.object({
          path: z.string().describe('Site-relative path, e.g. "index.html" or "assets/app.js".'),
          content: z.string().describe('File contents (UTF-8 text, or base64 when encoding="base64").'),
          encoding: z.enum(['utf8', 'base64']).optional().describe('How `content` is encoded. Default utf8.'),
        }))
        .optional()
        .describe('Inline files to publish. Provide this OR `dir`.'),
      dir: z.string().optional().describe('Path to a local directory to publish (read recursively). Provide this OR `files`.'),
      slug: z.string().optional().describe('Update an existing OWNED site in place (requires an API key).'),
      claimToken: z.string().optional().describe('Update an existing ANONYMOUS site in place (from a prior publish response).'),
      ttlSeconds: z.number().int().positive().optional().describe('Anonymous-site lifetime in seconds (capped server-side, default 24h).'),
      spaMode: z.boolean().optional().describe('Serve index.html for deep links (single-page apps).'),
      apiKey: z.string().optional().describe('shiply API key (shp_…) for owned publishes. Falls back to SHIPLY_API_KEY.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async ({ files, dir, slug, claimToken, ttlSeconds, spaMode, apiKey }) => {
    const items = []
    if (dir) {
      const root = resolve(dir)
      for (const abs of walk(root)) {
        items.push({ path: relative(root, abs).split(sep).join('/'), buf: readFileSync(abs) })
      }
    } else if (files?.length) {
      for (const f of files) items.push({ path: f.path, buf: Buffer.from(f.content, f.encoding === 'base64' ? 'base64' : 'utf8') })
    } else {
      throw new Error('Provide either `files` (inline) or `dir` (a local directory).')
    }
    if (items.length === 0) throw new Error('No files to publish.')

    const manifest = items.map((m) => ({
      path: m.path,
      size: m.buf.byteLength,
      contentType: contentTypeFor(m.path),
      hash: sha256(m.buf),
    }))
    const body = { files: manifest }
    if (slug) body.slug = slug
    if (claimToken) body.claimToken = claimToken
    if (ttlSeconds) body.ttlSeconds = ttlSeconds
    if (spaMode) body.spaMode = spaMode

    const created = await api('POST', '/api/v1/publish', body, apiKey)
    for (const up of created.upload?.uploads ?? []) {
      const m = items.find((x) => x.path === up.path)
      if (!m) continue
      const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: m.buf })
      if (!put.ok) throw new Error(`Upload failed for ${up.path}: HTTP ${put.status}`)
    }
    const finalizeUrl = created.upload?.finalizeUrl
    let fin
    if (finalizeUrl) {
      const res = await fetch(finalizeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey || ENV_KEY ? { authorization: `Bearer ${apiKey || ENV_KEY}` } : {}) },
        body: JSON.stringify({ versionId: created.upload.versionId }),
      })
      fin = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`Finalize failed: HTTP ${res.status}`)
    } else {
      fin = await api('POST', `/api/v1/publish/${created.slug}/finalize`, { versionId: created.upload.versionId }, apiKey)
    }

    return ok({
      siteUrl: fin.siteUrl || created.siteUrl,
      slug: created.slug,
      claimUrl: created.claimUrl ?? null,
      toUpdate: created.toUpdate,
      live: true,
    })
  },
)

server.registerTool(
  'site_status',
  {
    title: 'Get site status',
    description:
      'Look up a published shiply.now site by slug: whether it is live, anonymous vs owned, when it expires, ' +
      'and its public URL. Read-only.',
    inputSchema: {
      slug: z.string().describe('The site slug, e.g. "clever-aspen-6n6r" (the <slug>.shiply.now subdomain).'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ slug }) => ok(await api('GET', `/api/v1/sites/${encodeURIComponent(slug)}`)),
)

server.registerTool(
  'rollback_site',
  {
    title: 'Roll back a site',
    description:
      'Flip a previously-published version of a site live again, instantly. Every publish is a version; pass the ' +
      'versionId to roll back to. Requires an API key (owned sites only).',
    inputSchema: {
      slug: z.string().describe('The site slug to roll back.'),
      versionId: z.string().describe('The version id to make live (from an earlier publish).'),
      apiKey: z.string().optional().describe('shiply API key (shp_…). Falls back to SHIPLY_API_KEY.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ slug, versionId, apiKey }) =>
    ok(await api('POST', `/api/v1/publish/${encodeURIComponent(slug)}/rollback`, { versionId }, apiKey)),
)

server.registerTool(
  'add_custom_domain',
  {
    title: 'Add a custom domain',
    description:
      'Attach a custom domain to a site. Returns the domain record; point the hostname at cname.shiply.now and ' +
      'the certificate auto-issues. Poll readiness with check_custom_domain. Requires an API key.',
    inputSchema: {
      hostname: z.string().describe('The custom hostname, e.g. "www.example.com".'),
      slug: z.string().describe('The site slug to attach the domain to.'),
      apiKey: z.string().optional().describe('shiply API key (shp_…). Falls back to SHIPLY_API_KEY.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async ({ hostname, slug, apiKey }) => ok(await api('POST', '/api/v1/domains', { hostname, slug }, apiKey)),
)

server.registerTool(
  'check_custom_domain',
  {
    title: 'Check custom-domain readiness',
    description:
      'Check whether a custom domain has finished provisioning (DNS + SSL). Returns ready:true once the site is ' +
      'serving on the domain. Read-only. Requires an API key.',
    inputSchema: {
      domainId: z.string().describe('The domain id returned by add_custom_domain.'),
      apiKey: z.string().optional().describe('shiply API key (shp_…). Falls back to SHIPLY_API_KEY.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ domainId, apiKey }) => ok(await api('GET', `/api/v1/domains/${encodeURIComponent(domainId)}/check`, undefined, apiKey)),
)

const transport = new StdioServerTransport()
await server.connect(transport)
