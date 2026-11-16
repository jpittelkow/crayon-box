import { defineConfig, devices } from '@playwright/test';

// A port of its own: other dev servers in this repo (the app on 5173, spikes on 5180 and up) must never be mistaken
// for the test server, which `reuseExistingServer` would do silently. `PW_PORT` gives a worktree its own port when
// several run their browser tests at once.
const PORT = Number(process.env.PW_PORT ?? 5391);

// Browser tests (ADR 0015): Chromium with touch emulation on the 1280 x 800 reference screen (ADR 0016).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Opening a page builds its region map (2048 x 1536) in a worker; with every test running at once that can take
  // longer than the default 5 s.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-touch',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
