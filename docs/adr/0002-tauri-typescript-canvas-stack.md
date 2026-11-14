# 0002. Tauri 2 + TypeScript + HTML canvas

- Status: Proposed
- Date: 2026-11-14

## Context
The app runs on one Windows touch-screen laptop. It needs smooth finger painting, flood fill on large images,
file access (pages, saved art), printing, and self-updating from GitHub. Jeff should install it like any other
Windows app.

Options considered:

| Option | Installer size | Notes |
|---|---|---|
| Tauri 2 (WebView2 + Rust shell) | ~5–10 MB | Uses Edge WebView2 already on Windows 10/11. Built-in signed updater plugin. |
| Electron | ~80–100 MB | Mature, but ships a whole Chromium. Updater via electron-updater. |
| Native (WinUI/.NET) | small | Best Windows integration, but slower to build and no browser preview. |
| Plain web app / PWA | none | Easiest, but weak file access, no real installer, updates tied to hosting. |

## Decision
Build the UI in TypeScript with HTML canvas (Vite for bundling, no UI framework needed for the kid screens; a
small one may be used for the parent area). Package with Tauri 2 for Windows (NSIS installer).
Rust code stays thin:
- File system and updates use official Tauri plugins.
- Credential storage has no official plugin. It uses the Rust `keyring` crate (or a community keyring plugin)
  behind one small command, which stores the key in Windows Credential Manager (ADR 0006).
- Printing has no official plugin either. When it is picked up (ADR 0010) it uses the webview's own print dialog.
- The kiosk keyboard lock is a small Windows-only Rust module (ADR 0014).

All app logic and UI are web technology (HTML, CSS, TypeScript, canvas); Tauri is only the installer, window and
OS bridge. The app also runs in a normal browser for development, previews and tests.

## Consequences
- Small installer, fast start, and the same code runs in a browser for quick previews and testing.
- Builds need Rust + Node; we build in GitHub Actions (see ADR 0009), so Jeff's laptop needs neither.
- WebView2 must be present; the installer bootstraps it if missing.
