import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Static JSON feed of docs tagged `#status` in Outline, newest first —
// consumed by the status.chorlton.news site so it doesn't need to scrape
// bhng.org.uk's HTML. Rebuilt on every deploy (hourly, via the Outline sync
// workflow). See scripts/sync-wiki.mjs for how the tag is detected.
export const GET: APIRoute = async () => {
  const entries = await getCollection('docs', entry => entry.data.status === 'true');

  const updates = entries
    .map(entry => ({
      title: entry.data.title,
      collection: entry.data.collection,
      summary: entry.data.summary,
      url: `https://bhng.org.uk/docs/${entry.id.replace(/\.md$/, '')}`,
      updatedAt: entry.data.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return new Response(JSON.stringify({ updates }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
