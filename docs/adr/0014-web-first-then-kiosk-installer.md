# 0014. Web app first, then an installer with a kiosk lock

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff wants to test early as a web app. The installed Windows app is what makes it toddler-safe: true full
screen, keyboard locked down, and no accidental closing.

## Decision
**Phase 1: web app.** The same TypeScript code (ADR 0002) runs in Edge, served from the dev machine or as a
static site. It uses the browser Fullscreen API and blocks what a page can (pinch-zoom, context menu, text
selection, swipe back). Storage uses the browser (IndexedDB) behind the same storage interface the installed app
uses for files, so nothing changes in game code later. Good for testing pages, tools and layout with the kids.
Known gaps: Esc leaves full screen, Alt+F4 / Ctrl+W / Windows key still work.

**Phase 2: installer (Tauri) adds a kiosk lock**, switchable in the parent area:
- Starts borderless full screen; the window can't be resized or minimized.
- The close request (Alt+F4, title bar, taskbar "Close window") is intercepted and ignored; only the parent area's
  *Quit app* or `Ctrl+Shift+Q` closes the app.
- **Keyboard lock:** a small Rust module installs a Windows low-level keyboard hook while the app has focus and
  swallows the Windows key, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, F11 and all ordinary keys. The parent unlock
  works by touch, so the keyboard isn't needed. The hook is released when the parent area is open or the app quits.
- Edge gestures: swipes from the screen edges are reduced by full-screen mode; Windows' own "edge swipe" can also
  be turned off with a documented policy setting if the kids still trigger it.
- Ctrl+Alt+Del can't be blocked by any app (Windows security), which also means a parent can always get out.

## Consequences
- Kids can play in the web version now; the installer later closes the remaining escape routes.
- The keyboard hook is Windows-only Rust code; it's isolated behind a setting so it can be turned off if it ever
  misbehaves.
