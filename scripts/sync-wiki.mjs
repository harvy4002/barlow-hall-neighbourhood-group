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

// Outline has no native tags API, so authors flag a doc as a status-page
// update by starting a line with `#status` followed by a one-line summary,
// e.g. "#status Summer event confirmed for June 20th" — the same convention
// Outline's own (unshipped) tags feature is expected to use. That line is
// dropped from the rendered doc; the summary text feeds /updates.json, which
// also links back to this doc for the full detail. A bare `#status` with no
// trailing text still flags the doc, just with no summary to show.
const STATUS_TAG_LINE = /^[ \t]*#status(?:[ \t]+(.+?))?[ \t]*$/im;

/** Detects and strips the `#status [summary]` marker line. Returns { isStatus, summary, markdown }. */
function extractStatusTag(markdown) {
  const match = markdown.match(STATUS_TAG_LINE);
  if (!match) {
    return { isStatus: false, summary: undefined, markdown };
  }
  return {
    isStatus: true,
    summary: match[1]?.trim() || undefined,
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
      const { isStatus, summary, markdown: destatused } = extractStatusTag(cleaned);
      const markdown = await localiseImages(destatused);

      writePage(filePath, {
        title: doc.title,
        collection: col.name,
        collectionSlug: colSlug,
        documentId: doc.id,
        updatedAt: doc.updatedAt,
        ...(doc.parentDocumentId ? { parentDocumentId: doc.parentDocumentId } : {}),
        ...(isStatus ? { status: 'true' } : {}),
        ...(summary ? { summary } : {}),
      }, markdown);

      console.log(`   ✓ ${doc.title}${isStatus ? '  [status]' : ''}`);
      totalDocs++;
    }
  }

  console.log(`\n✅ Synced ${totalDocs} document(s) across ${collections.length} collection(s)`);
}

main().catch(err => {
  console.error('\n❌ Sync failed:', err.message);
  process.exit(1);
});
