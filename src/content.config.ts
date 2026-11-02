import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    collection: z.string(),
    collectionSlug: z.string(),
    // Sidebar positions from Outline (see scripts/sync-wiki.mjs). writePage
    // quotes every value, hence the coercion.
    collectionOrder: z.coerce.number().optional(),
    order: z.coerce.number().optional(),
    documentId: z.string(),
    updatedAt: z.string(),
    parentDocumentId: z.string().optional(),
    // JSON-encoded array of { date, summary } — one entry per `#status` line
    // found in the doc body (see scripts/sync-wiki.mjs). A doc with a single
    // tagged line has one entry; a dedicated "updates log" doc can have many.
    // Feeds /updates.json.
    statusUpdates: z.string().optional(),
  }),
});

export const collections = { docs };
