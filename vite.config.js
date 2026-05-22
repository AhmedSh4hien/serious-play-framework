import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/serious-play-framework/',
  build: {
    rollupOptions: {
      input: {
        chemistry: resolve(__dirname, 'index.html'),
        recycling: resolve(__dirname, 'recycling.html'),
      },
    },
  },
});