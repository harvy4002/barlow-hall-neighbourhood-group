import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

type StatusUpdate = { date: string; summary?: string };

// Static JSON feed of `#status`-tagged lines from Outline docs, newest first
// — consumed by the status.chorlton.news site so it doesn't need to scrape
// bhng.org.uk's HTML. Rebuilt on every deploy (hourly, via the Outline sync
// workflow). See scripts/sync-wiki.mjs for how tags are detected; a single
// doc can contribute more than one entry (e.g. a running "updates log" doc
// with several dated `#status` lines), so this flatMaps rather than maps.
export const GET: APIRoute = async () => {
  const entries = await getCollection('docs', entry => Boolean(entry.data.statusUpdates));

  const updates = entries
    .flatMap(entry => {
      const url = `https://bhng.org.uk/docs/${entry.id.replace(/\.md$/, '')}`;
      const parsed = JSON.parse(entry.data.statusUpdates!) as StatusUpdate[];
      return parsed.map(({ date, summary }) => ({
        title: entry.data.title,
        collection: entry.data.collection,
        summary,
        url,
        updatedAt: date,
      }));
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return new Response(JSON.stringify({ updates }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
