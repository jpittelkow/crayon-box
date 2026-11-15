import { defineConfig } from 'vite';

// A throwaway test page for ADR 0021. Local only, like the app itself (ADR 0014).
export default defineConfig({
  server: { host: 'localhost', port: 5180, strictPort: true },
  build: { target: 'es2022' },
});
