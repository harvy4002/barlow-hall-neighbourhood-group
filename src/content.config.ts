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
  }),
});

export const collections = { docs };
