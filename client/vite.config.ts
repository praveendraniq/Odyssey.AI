import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The package is a declared dependency. Runtime provider failures are handled
  // by the app's simulated/text fallback rather than by probing the filesystem.
  define: { __VOCAL_BRIDGE_SDK_AVAILABLE__: JSON.stringify(true) },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
