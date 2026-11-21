# 0046. A Linux version: the same Tauri shell, an AppImage, and a kids' session that is only the app

- Status: Proposed (2026-11-21)
- Date: 2026-11-21
- Would supersede, if accepted, **for Linux only**: "Releases are only for the Windows installer" in
  [ADR 0009](0009-install-and-update-from-github.md); the keyboard hook and the Windows laptop setup in
  [ADR 0014](0014-web-first-then-kiosk-installer.md); "Edge WebView2" as the engine in
  [ADR 0002](0002-tauri-typescript-canvas-stack.md). On Windows all three stand as they are.
- Builds on: [ADR 0007](0007-artwork-storage-and-kid-profiles.md) (files), [0024](0024-family-sync-server.md) (sync),
  [0015](0015-testing-approach.md) (testing).
- Plan: [linux-plan.md](../linux-plan.md), with the owner's choices L1 to L10.

## Context
The owner asked (2026-11-21) what it would take to run the app on Linux, on a touch laptop or PC, and then asked
for it to be planned.

A trial the same day built the working tree in an Ubuntu 26.04 WSL distro and drove the built app on a headless
display (journal, [2026-11-21](../journal/2026-11-21.md); scripts in `spikes/linux-trial/`). What it showed:
- The shell builds for Linux with one line changed, and makes a `.deb` (13 MB) and an AppImage (96 MB).
- Under WebKitGTK 2.52 the app starts in about a second; coloring fills, the driving game draws, the shipped
  sounds decode, storage files are written.
- Two real faults: finished pictures are refused ("forbidden path", the temp file's name starts with a dot), and
  the Pictures folder is not found on an account without the standard folders.
- Not answered: the driving game's speed on real graphics, touch, pen, the microphone, the lock.

Three things differ from Windows by nature, not by accident:
- **The engine.** Tauri uses the system's web view: WebView2 (Chromium) on Windows, WebKitGTK on Linux. Tauri's
  own docs warn that WebGL can fall onto a slow path there, worst with NVIDIA drivers, and that the page cannot
  tell (it reports "Apple GPU" on every machine).
- **The lock.** A Windows low-level keyboard hook has no twin under Wayland; an app cannot swallow the desktop's
  own keys and touch gestures.
- **Updates.** Only an AppImage can replace itself; a `.deb` is updated by the system's package tools.

### Options for the shell

| Option | Work | For | Against |
|---|---|---|---|
| **Tauri with WebKitGTK** (the same shell) | Small | One code base, one release flow, files, sync and updates as on Windows. The trial ran it. | A second engine to test on. Driving speed unknown until measured on the laptop. |
| Chromium in kiosk mode on a local page | Medium | The engine the app is built and tested on. | No shell: storage in the browser, no Pictures folder, no updater; needs something to serve the files. |
| An Electron shell for Linux | Large | Chromium and a real shell. | A second shell to write and keep (files, kiosk, updates), about 100 MB more. |

## Decision
1. **Linux gets the same Tauri shell.** No second shell is written unless the gate in point 2 fails.
2. **A gate on the real laptop before the rest is built.** The driving game must hold the frame rate the owner
   accepts on that laptop under WebKitGTK, and touch must work for coloring, letters and driving. If either fails
   and can't be fixed in the app, this ADR is dropped or rewritten for a Chromium shell; the small fixes made
   before the gate cost nothing on Windows.
3. **One architecture: x86-64.** No ARM build.
4. **The release file is an AppImage**, built on the oldest Ubuntu release GitHub's runners offer that has
   WebKitGTK 4.1 (22.04 today), with the media framework bundled so sounds play on a bare system. It is large:
   96 MB without the sound plugins and up to 171 MB with them in the trial, against the Windows installer's few.
   A `.deb` is not released: it could not update itself.
5. **A Linux copy updates itself the same way a Windows copy does** (owner, 2026-11-21). The same check at start
   and on *Check now*, the same Updates screen in the parent area with *Install and restart*, only published
   releases offered, the same signature check, and never anything on a kid's screen (ADR 0009). The same tag
   builds both systems; one draft release holds both files, their signatures and one `latest.json` with a
   `windows-x86_64` and a `linux-x86_64` entry, signed with the same key. A release is drafted only when both
   builds pass. Under the hood the updater replaces the AppImage and the app starts itself again (the Windows
   installer does that part for it), so the AppImage must sit where the kids' account can write.
6. **The lock is the session, not a hook.** The kids' account signs in to a session that runs only the app, under
   the kiosk compositor `cage`: no desktop, no task switcher, no edge gestures, no switching to a text console.
   Full screen and the ignored close request stay as on Windows. There is no keyboard hook on Linux and the
   *Lock the keyboard* switch does not show; the page's own key guard (`guards.ts`) still swallows what reaches
   it. Quitting the app ends the session and lands on the sign-in screen. *Unlock the window* does not show in
   that session, since there is nothing else to switch to.
7. **Starting at sign-in is the session's job.** The kids' account is set to sign in by itself and its session is
   the app. *Start when Windows starts* is worded per system, and on Linux only matters when the app is run
   inside an ordinary desktop.
8. **The app works in an ordinary desktop too**, for a parent trying it or a family that doesn't want the kiosk
   session, with the lock that weak: full screen and the ignored close request only. The setup guide says so.
9. **Files keep their places**, by each system's own rules: the working copy in the app's local data folder
   (`~/.local/share/org.crayonbox.coloring`), finished pictures and the pages inbox in the account's Pictures
   folder. Where the account has no Pictures folder the parent area says so; kid screens never do.
10. **The microphone is allowed for the app's own page and nothing else is.** The shell answers WebKitGTK's
    permission request for audio capture; camera, screen and location requests are refused.
11. **No built-in speech on Linux.** WebKitGTK has no `speechSynthesis`; the narrator's shipped clips and a
    parent's recordings cover everything a kid hears, and the fallback voice simply stays silent.
12. **Tests.** CI builds the AppImage and runs the Rust tests on Linux for every pull request, and drives the
    built app through WebKit's WebDriver for a short smoke run (start, fill a shape, the finished picture is
    written, the driving game opens). The full browser suite stays on Chromium. Hand checks on the laptop join
    the release checklist.

## What does not change
- All game code, the storage layer, sync and the family server (already a Linux container), AI pages through the
  server, the parent gate, the toddler rules (ADR 0003), the privacy rule.
- Windows: its installer, hook, setup guide and release flow, apart from the release job gaining a second build.

## Consequences
- A second platform to check before each release: one more build, one more hand check, and a release now waits
  for both builds.
- Bugs that only WebKitGTK has will turn up (the dot-file refusal was the first). The smoke run catches the
  coarse ones; the rest need the laptop.
- The Linux lock is stronger than the Windows one where it matters (no desktop underneath), but it depends on a
  parent setting the session up by hand, with a guide. Until then the app is an ordinary full-screen window.
- The AppImage carries its own WebKitGTK, so it is large and does not get the system's security updates to the
  web view; a new release is how it gets them. The app only loads its own files and the family server.
- If the gate fails, the fixes of phase A remain (they are harmless on Windows) and the rest is not built.
