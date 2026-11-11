import { defineConfig } from 'vite';

// `base: './'` makes every asset path relative, so the built site works from a
// domain root, a sub-folder, or any static host without changes.
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, cssMinify: true },
  server: { open: false },
});
