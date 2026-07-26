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
  }),
});

export const collections = { docs };
