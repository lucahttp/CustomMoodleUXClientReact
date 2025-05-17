import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
/*
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `react/[name].js`,
        chunkFileNames: `react/[name].js`,
        assetFileNames: `react/[name].[ext]`,
      },
    },
  },
})
*/

import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindcssPlugin from '@tailwindcss/postcss'; // Import the new plugin

export default defineConfig({
  plugins: [
    react(), tsconfigPaths()
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcssPlugin(), // Use the @tailwindcss/postcss plugin
        autoprefixer(),
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `react/[name].js`,
        chunkFileNames: `react/[name].js`,
        assetFileNames: `react/[name].[ext]`,
      },
    },
  },
});

