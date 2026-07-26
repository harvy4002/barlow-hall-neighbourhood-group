// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://harvy4002.github.io',
  base: '/barlow-hall-neighbourhood-group',
  vite: {
    plugins: [tailwindcss()]
  }
});