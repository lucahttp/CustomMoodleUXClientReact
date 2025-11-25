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
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
        ],
      },
    }),
    tsconfigPaths()
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
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
      output: {
        entryFileNames: `react/[name].js`,
        chunkFileNames: `react/[name].js`,
        assetFileNames: `react/[name].[ext]`,
      },
    },
  },
});

