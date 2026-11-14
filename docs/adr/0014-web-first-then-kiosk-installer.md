# 0014. Web app first, then an installer with a kiosk lock

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff wants to test early as a web app. The installed Windows app is what makes it toddler-safe: true full
screen, keyboard locked down, and no accidental closing.

## Decision
The work is split into three milestones. Other ADRs refer to them by these names.

| Milestone | What it delivers |
|---|---|
| 1. Web app | The coloring game in a browser |
| 2. Installer | The Windows app (Tauri) with the kiosk lock, file storage, updates and the AI page maker |
| 3. Racing game | The second game (ADR 0012) |

Milestone 1 comes first. Whether the installer or the racing game comes next is an open question for the owner.

### Milestone 1: web app
The same TypeScript code (ADR 0002) runs in Edge, served from the dev machine or as a static site. It uses the
browser Fullscreen API and blocks what a page can (pinch-zoom, context menu, text selection, swipe back). Storage
uses the browser (IndexedDB) behind the same storage interface the installed app uses for files, so nothing
changes in game code later. Good for testing pages, tools and layout with the kids.

- **In:** the shell with the kid picker, the coloring engine (ADR 0004), built-in pages, autosave and the
  gallery (ADR 0007), the parent gate with basic settings and page hiding (ADR 0008).
- **Out:** the AI page maker (ADR 0006), the Pictures folder and loose-file pickup (ADR 0005, 0007), updates
  (ADR 0009), the kiosk lock, printing (ADR 0010).
- **Art made here is throwaway.** Browser storage is separate from the installed app's files and the browser can
  clear it. The app asks the browser to keep it (`navigator.storage.persist()`), but nothing is carried over to
  milestone 2.
- **Known gaps:** Esc leaves full screen, Alt+F4 / Ctrl+W / Windows key still work.
- **Stopgap:** a desktop shortcut that starts Edge in its own kiosk mode
  (`msedge.exe --kiosk <url> --edge-kiosk-type=fullscreen --no-first-run`) runs the page full screen without
  browser controls. It is not a complete lockdown, and the laptop setup below still applies.

### Milestone 2: installer (Tauri) adds a kiosk lock
Switchable in the parent area:
- Starts borderless full screen; the window can't be resized or minimized.
- The close request (Alt+F4, title bar, taskbar "Close window") is intercepted and ignored; only the parent area's
  *Quit app* or `Ctrl+Shift+Q` closes the app.
- **Keyboard lock:** a small Rust module installs a Windows low-level keyboard hook while the app has focus and
  swallows the Windows key, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, F11 and all ordinary keys. The one exception is
  `Ctrl+Shift+Q`, which it lets through (ADR 0008). The parent gate works by touch, so the keyboard isn't needed.
  The hook is released when the parent area is open or the app quits.
- **What no app can block:**
  - Ctrl+Alt+Del (Windows security), which also means a parent can always get out.
  - Win+L, which locks the screen. A kid who hits it lands on the lock screen and a parent signs back in.
- **Antivirus risk:** an unsigned app that hooks the keyboard can look like a keylogger to Windows Defender. If it
  is flagged, turn the keyboard lock off in the parent area, or sign the app (ADR 0009).

### Laptop setup (done once by a parent, both milestones)
The app can't change these Windows settings itself. They are written up as a short setup guide with the app.
1. **A separate Windows account for the kids**, standard (not administrator), with the app installed there and
   set to start at sign-in. If a kid does get out of the app, they land in an empty account, not a parent's files
   and email.
2. **Turn off three- and four-finger touch gestures** (Settings > Bluetooth & devices > Touch). Left on, a hand
   on the screen can open task view or show the desktop.
3. **Turn off the touchpad's multi-finger gestures** (Settings > Bluetooth & devices > Touchpad).
4. **Turn on Do not disturb** in that account, so notifications don't pop over the app.
5. **Edge swipes:** full-screen mode reduces swipes from the screen edges; Windows' own "edge swipe" can also be
   turned off with a documented policy setting if the kids still trigger it.

## Consequences
- Kids can play in the web version now; the installer later closes most of the remaining escape routes, and the
  laptop setup covers the ones an app can't.
- The keyboard hook is Windows-only Rust code; it's isolated behind a setting so it can be turned off if it ever
  misbehaves.
- The kids' Windows account means the app, its updates and the OpenRouter key live in that account.
