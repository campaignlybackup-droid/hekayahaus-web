import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.hekayahaus.com',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: { build: { assetsInlineLimit: 2048 } },
});
