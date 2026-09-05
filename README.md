# Barlow Hall Neighbourhood Group

Website for the Barlow Hall Neighbourhood Group — an award-winning community group supporting the Barlow Hall area of Chorlton Park, Manchester.

Built with [Astro](https://astro.build) + [Tailwind CSS](https://tailwindcss.com), deployable to [GitHub Pages](https://pages.github.com).

## Pages

- **Home** — Introduction and social media links
- **About** — Who we are, our committee, and our area
- **Meetings** — When and where we meet

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Updating Meeting Details

Edit `src/pages/meetings.astro` and update the `nextMeeting` object at the top of the file.

## Updating Committee Members

Edit `src/pages/about.astro` and update the `committee` array at the top of the file.

## Docs / wiki sync

`/docs` content is synced hourly (see `.github/workflows/sync-wiki.yml`) from
a self-hosted Outline wiki via `scripts/sync-wiki.mjs`, which pulls every
document into `src/content/docs/` as markdown with frontmatter.

To flag a doc as a status update — surfaced via `/updates.json` for the
status.chorlton.news site — start a line in the document body with `#status`
followed by a one-line summary, e.g.:

```
#status Summer event confirmed for June 20th on Mottram Avenue
```

The sync script detects the tag, strips that line from the rendered page,
and records the summary text plus a link back to this doc in the feed. A
bare `#status` with no text still flags the doc, just with no summary shown.
Outline has no native tags feature, so this hashtag convention is what
stands in for one.

## Deploying to GitHub Pages

See `/.github/workflows/deploy.yml` for the automated deployment workflow. Every push to `main` will rebuild and deploy the site.
