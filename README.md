# crayon-box

A touch-screen app for little kids (ages 4 and under), starting with a coloring book and with room for more games
(a simple racing game is planned next).

- Built with web technology (TypeScript + HTML canvas), runs in a browser for testing, and ships as a Windows app
  (Tauri) with full-screen kiosk mode and in-app updates from GitHub Releases.
- Design decisions: [docs/adr](docs/adr/README.md)
- Project memory and session journal: [docs/memory](docs/memory/README.md), [docs/journal](docs/journal/README.md)
- Contributor and AI guidance, including the privacy rule: [CLAUDE.md](CLAUDE.md)
- License: code is [MIT](LICENSE); built-in coloring pages are CC0 ([ADR 0011](docs/adr/0011-line-art-licensing.md));
  bundled fonts are listed in [CREDITS.md](CREDITS.md)

## Running it locally
The web app (milestone 1, [ADR 0014](docs/adr/0014-web-first-then-kiosk-installer.md)) runs on this machine only;
it is never hosted online. Needs Node 24.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npx playwright install chromium
npm run test:e2e     # browser tests with touch emulation (Playwright)
```
