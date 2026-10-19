import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Inline plugin to resolve named WebSocket exports from isomorphic-ws in browser builds
const fixIsomorphicWs = (): Plugin => ({
  name: 'fix-isomorphic-ws',
  resolveId(id) {
    if (id === 'isomorphic-ws') return '\0isomorphic-ws-virtual';
    return null;
  },
  load(id) {
    if (id === '\0isomorphic-ws-virtual') {
      return `
        const WS = typeof window !== 'undefined' ? window.WebSocket : globalThis.WebSocket;
        export { WS as WebSocket };
        export default WS;
      `;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    fixIsomorphicWs(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    target: 'esnext',
    commonjsOptions: {
      include: [/buffer/, /object-inspect/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    include: [
      'buffer',
      'object-inspect',
    ],
    needsInterop: [
      'buffer',
      'object-inspect',
    ],
    // Exclude raw WebAssembly crates from pre-bundling
    exclude: [
      '@midnight-ntwrk/ledger',
      '@midnight-ntwrk/zswap',
    ],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});