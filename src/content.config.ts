import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    collection: z.string(),
    collectionSlug: z.string(),
    documentId: z.string(),
    updatedAt: z.string(),
    parentDocumentId: z.string().optional(),
    // "true" when the doc's Outline body contains a `#status` tag (see
    // scripts/sync-wiki.mjs) — flags it for inclusion in /updates.json.
    status: z.string().optional(),
    // One-line text following the `#status` tag, e.g.
    // "#status Summer event confirmed for June 20th" — shown on the status
    // page in place of the full doc body.
    summary: z.string().optional(),
  }),
});

export const collections = { docs };
