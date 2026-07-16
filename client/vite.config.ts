import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const vocalBridgeReactPackage = '@vocalbridgeai/react';
let vocalBridgeSdkAvailable = false;
try {
  await import(vocalBridgeReactPackage);
  vocalBridgeSdkAvailable = true;
} catch {
  // The deterministic fallback keeps local/offline builds usable. Once pnpm
  // installs the official package, Vite automatically resolves the real SDK.
}

export default defineConfig({
  plugins: [react()],
  define: { __VOCAL_BRIDGE_SDK_AVAILABLE__: JSON.stringify(vocalBridgeSdkAvailable) },
  resolve: {
    alias: vocalBridgeSdkAvailable ? {} : {
      '@vocalbridgeai/react': new URL('./src/vendor/vocal-bridge-react-fallback.tsx', import.meta.url).pathname,
    },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
