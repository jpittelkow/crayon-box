# 0020. The web app runs from the dev server; playtests open it in an Edge app window

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Supersedes: in ADR 0014, the local container that serves the built files "when a steadier copy is wanted", and
  the Edge kiosk-mode shortcut given as a stopgap.

## Context
ADR 0014 planned two ways to run the web milestone: the Vite dev server while building, and a local container
on the dev machine for a steadier copy. The owner decided the container was only ever a development convenience
and is not needed to play: the web app is a stepping stone to the installer (milestone 2), so there is nothing to
gain from packaging it.

ADR 0014 also suggested starting Edge in kiosk mode
(`msedge.exe --kiosk <url> --edge-kiosk-type=fullscreen`) for full screen without browser controls. Microsoft's
kiosk-mode documentation says both kiosk types run an InPrivate session (checked 2026-11-14). InPrivate storage
does not outlive the window, so the kids' pictures and the parent's settings, which the web app keeps in
IndexedDB (ADR 0007), would be lost every time the kiosk window closed.

## Decision
- **No container.** The web app runs from the Vite dev server (`npm run dev`) on the dev machine. Nothing is
  built into an image or served any other way. Still never hosted online (ADR 0014).
- **Playtests open it in an Edge app window**, not kiosk mode: `scripts/playtest.cmd` starts Edge with `--app`
  and `--start-fullscreen` on its own browser profile folder, so the browser bars are gone and stored pictures
  survive closing the window. The app also asks for full screen on the first touch.
- The known gaps of ADR 0014 stay, and get one more: in an app window Esc and F11 can leave full screen. The
  installer's kiosk lock (milestone 2) is what closes them.

## Consequences
- One less thing to build and keep working. The dev machine must have Node and the repo, which it does.
- Pictures made in playtests persist in the playtest profile until that folder is deleted. They are still
  throwaway: nothing carries over to the installer (ADR 0014).
- A kid can leave full screen more easily than in kiosk mode; a parent nearby puts it back.
