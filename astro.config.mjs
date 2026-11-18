// @ts-check
import { defineConfig } from 'astro/config';
import legacyUrls from './integrations/legacy-urls.mjs';

export default defineConfig({
  site: 'https://clarazimmer.com',
  // /About is emitted as About/index.html: GitHub Pages is case-sensitive and serves it at /About/.
  build: { format: 'directory' },
  trailingSlash: 'ignore',
  integrations: [legacyUrls()],
  devToolbar: { enabled: false },
});
