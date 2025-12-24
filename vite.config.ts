import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  base: './',
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three'],
          'vendor-zustand': ['zustand'],
        },
        // Use hashed chunk names for cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Warn if chunks exceed 500KB
    chunkSizeWarningLimit: 500,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize dependencies pre-bundling
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'zustand'],
    // Exclude large dependencies that don't need transformation
    exclude: [],
  },
  // Enable esbuild optimizations
  esbuild: {
    // Drop console.log in production
    drop: process.env.TAURI_DEBUG ? [] : ['console', 'debugger'],
    // Minify identifiers in production
    minifyIdentifiers: !process.env.TAURI_DEBUG,
    minifySyntax: !process.env.TAURI_DEBUG,
    minifyWhitespace: !process.env.TAURI_DEBUG,
  },
})
