#!/usr/bin/env node
/**
 * Syncs wiki content from a self-hosted Outline instance into Astro content collections.
 *
 * Required environment variables:
 *   OUTLINE_URL     - Base URL of your Outline instance, e.g. https://wiki.yourdomain.org.uk
 *   OUTLINE_API_KEY - Outline API token (create one in Outline → Settings → API Tokens)
 *
 * Usage:
 *   node scripts/sync-wiki.mjs
 *   OUTLINE_URL=https://... OUTLINE_API_KEY=ol_... node scripts/sync-wiki.mjs
 *
 * Output:
 *   src/content/wiki/[collection-slug]/[doc-slug].md   — markdown pages
 *   public/wiki-images/[hash].[ext]                    — downloaded images
 */

import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUTLINE_URL = process.env.OUTLINE_URL?.replace(/\/$/, '');
const OUTLINE_API_KEY = process.env.OUTLINE_API_KEY;

if (!OUTLINE_URL || !OUTLINE_API_KEY) {
  console.error('Error: OUTLINE_URL and OUTLINE_API_KEY environment variables are required.');
  process.exit(1);
}

const WIKI_DIR = join(ROOT, 'src/content/docs');
const IMAGES_DIR = join(ROOT, 'public/wiki-images');

// Collections whose names match any entry in this list (case-insensitive) are
// excluded from the public site. Add Outline's default collections or any
// internal-only collections here.
const EXCLUDED_COLLECTIONS = ['welcome'];

// Wipe and recreate wiki content on each sync so deleted Outline pages don't linger
if (existsSync(WIKI_DIR)) {
  rmSync(WIKI_DIR, { recursive: true });
}
mkdirSync(WIKI_DIR, { recursive: true });
mkdirSync(IMAGES_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Outline API helper
// ---------------------------------------------------------------------------

async function api(endpoint, body = {}) {
  const res = await fetch(`${OUTLINE_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OUTLINE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Outline API ${endpoint} → HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Image downloading
// ---------------------------------------------------------------------------

/** Downloads an Outline-hosted image and returns its local public path, or null on failure. */
async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${OUTLINE_API_KEY}` },
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = (res.headers.get('content-type') ?? 'image/jpeg')
      .split('/')[1]
      ?.split(';')[0] ?? 'jpg';
    const hash = createHash('md5').update(buffer).digest('hex').slice(0, 10);
    const filename = `${hash}.${ext}`;
    const dest = join(IMAGES_DIR, filename);

    // Skip re-downloading if the same image (same hash) already exists
    if (!existsSync(dest)) {
      writeFileSync(dest, buffer);
    }
    return `/wiki-images/${filename}`;
  } catch {
    return null; // leave original URL intact on failure
  }
}

// ---------------------------------------------------------------------------
// Status tag extraction
// ---------------------------------------------------------------------------

// Outline has no native tags API, so authors flag lines as status-page
// updates by starting them with `#status`, optionally followed by an
// explicit date and a one-line summary — the same convention Outline's own
// (unshipped) tags feature is expected to use, e.g.:
//
//   #status Summer event confirmed for June 20th
//   #status 2026-09-01 Summer event confirmed for June 20th
//
// Every matching line in a doc becomes one entry (falling back to the doc's
// own `updatedAt` when no explicit date is given), which supports two
// authoring styles with the same syntax: tagging a single line inside an
// existing doc like meeting minutes (one match, dated from the doc itself),
// or maintaining a dedicated running "updates log" doc with many dated
// `#status` lines (many matches, one per bullet). Matched lines are dropped
// from the rendered page either way.
//
// Outline's markdown export escapes a `#` at the start of a line as `\#`
// (so it isn't re-parsed as a heading elsewhere) — the optional `\\?` below
// matches both the escaped and unescaped forms.
const STATUS_TAG_LINE = /^[ \t]*\\?#status(?:[ \t]+(\d{4}-\d{2}-\d{2}))?(?:[ \t]+(.+?))?[ \t]*$/gim;

/**
 * Detects and strips every `#status` marker line. Returns
 * { updates: {date, summary}[], markdown }; `updates` is empty when the doc
 * has no tags at all.
 */
function extractStatusUpdates(markdown, fallbackDate) {
  const updates = [...markdown.matchAll(STATUS_TAG_LINE)].map(match => ({
    date: match[1] || fallbackDate,
    summary: match[2]?.trim() || undefined,
  }));
  return {
    updates,
    markdown: markdown.replace(STATUS_TAG_LINE, '').replace(/\n{3,}/g, '\n\n'),
  };
}

/** Rewrites Outline-hosted image URLs in markdown to local /wiki-images/ paths. */
async function localiseImages(markdown) {
  const outlineHost = OUTLINE_URL.replace(/^https?:\/\//, '');
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/([^)\s]+))\)/g;
  const replacements = [];

  for (const match of markdown.matchAll(imageRegex)) {
    const [full, alt, url, host] = match;
    if (host.startsWith(outlineHost)) {
      const localPath = await downloadImage(url);
      if (localPath) replacements.push([full, `![${alt}](${localPath})`]);
    }
  }

  return replacements.reduce((md, [orig, repl]) => md.replace(orig, repl), markdown);
}

// ---------------------------------------------------------------------------
// File writing helpers
// ---------------------------------------------------------------------------

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function yamlEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function writePage(filePath, frontmatter, body) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (val != null) lines.push(`${key}: "${yamlEscape(val)}"`);
  }
  lines.push('---', '', body);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ---------------------------------------------------------------------------
// Outline fetching with pagination
// ---------------------------------------------------------------------------

async function fetchAllDocuments(collectionId) {
  const docs = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data } = await api('documents.list', { collectionId, limit, offset });
    docs.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { data: collections } = await api('collections.list', { limit: 100 });
  console.log(`Found ${collections.length} collection(s)\n`);

  let totalDocs = 0;

  for (const col of collections) {
    if (EXCLUDED_COLLECTIONS.includes(col.name.toLowerCase())) {
      console.log(`⏭️  Skipping "${col.name}" (excluded collection)`);
      continue;
    }

    const colSlug = col.urlId || slugify(col.name);
    console.log(`📁 ${col.name}  →  ${colSlug}/`);

    const documents = await fetchAllDocuments(col.id);

    // Build documentId → slug map for resolving parent relationships
    const idToSlug = Object.fromEntries(
      documents.map(d => [d.id, d.urlId || slugify(d.title)])
    );

    for (const doc of documents) {
      const docSlug = doc.urlId || slugify(doc.title);

      // Produce nested path if the document has a parent in this collection
      let relPath = docSlug;
      if (doc.parentDocumentId && idToSlug[doc.parentDocumentId]) {
        relPath = `${idToSlug[doc.parentDocumentId]}/${docSlug}`;
      }

      const filePath = join(WIKI_DIR, colSlug, `${relPath}.md`);

      const { data: rawMarkdown } = await api('documents.export', { id: doc.id });
      // Outline sometimes returns literal \n escape sequences instead of real newlines
      const unescaped = rawMarkdown.replace(/\\n/g, '\n');
      // Outline includes the document title as a # heading — strip it since we render
      // the title ourselves in the page header to avoid it appearing twice
      const cleaned = unescaped.replace(/^#\s+.+\n+/, '');
      const { updates: statusUpdates, markdown: destatused } = extractStatusUpdates(cleaned, doc.updatedAt);
      const markdown = await localiseImages(destatused);

      writePage(filePath, {
        title: doc.title,
        collection: col.name,
        collectionSlug: colSlug,
        documentId: doc.id,
        updatedAt: doc.updatedAt,
        ...(doc.parentDocumentId ? { parentDocumentId: doc.parentDocumentId } : {}),
        ...(statusUpdates.length > 0 ? { statusUpdates: JSON.stringify(statusUpdates) } : {}),
      }, markdown);

      console.log(`   ✓ ${doc.title}${statusUpdates.length ? `  [status ×${statusUpdates.length}]` : ''}`);
      totalDocs++;
    }
  }

  console.log(`\n✅ Synced ${totalDocs} document(s) across ${collections.length} collection(s)`);
}

main().catch(err => {
  console.error('\n❌ Sync failed:', err.message);
  process.exit(1);
});
