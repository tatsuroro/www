import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tatsuroro.com',
  integrations: [sitemap()],
});
