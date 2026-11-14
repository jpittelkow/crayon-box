import { defineConfig } from 'vitest/config';

// The web app (milestone 1, ADR 0014) runs locally only: the dev server, or the built files served on this
// machine. Nothing here is meant for online hosting.
export default defineConfig({
  server: { host: 'localhost', port: 5173 },
  preview: { host: 'localhost', port: 4173 },
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
