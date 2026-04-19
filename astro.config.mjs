import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fukushima-love-kai.pages.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
