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

## Deploying to GitHub Pages

See `/.github/workflows/deploy.yml` for the automated deployment workflow. Every push to `main` will rebuild and deploy the site.
