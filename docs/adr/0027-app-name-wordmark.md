# 0027. The app's name as a wordmark on a few screens

- Status: Accepted (asked for by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
The owner asked (2026-11-14) for the app's name, Crayon Box, on the main screen and a few other places. Until now
it showed only in the window title. ADR 0003 rule 1 says kid screens have no text: every control is an icon, because
the kids can't read yet.

## Decision
- The name is drawn as a **wordmark**: "Crayon Box" in the display font (Fredoka), one crayon color per letter in
  rainbow order, an ink outline and a small alternating tilt, so it looks drawn by hand. One shared piece of UI
  (`src/ui/wordmark.ts`) in three sizes.
- It is a picture, not text a kid needs: never a button or part of one, never takes a touch
  (`pointer-events: none`), and screen readers hear it once as an image named "Crayon Box". ADR 0003 rule 1 is
  about controls, so this is the one allowed exception on kid screens, next to a kid's name under their badge
  (ADR 0018).
- Where it shows: across the top of the **kid picker** (large) and the **home screen** where a kid picks a game
  (medium); in the parent world at the top of the **parent gate** card and the **parent area's menu** (small); the
  Updates screen says "Crayon Box version …".
- Not inside the games: the coloring, letters and driving screens keep every pixel for play.

## Consequences
- The kid picker and home screen are a little busier at the top; the badges and game tiles stay centered below it.
- The browser test that checks kid screens have no text now ignores the wordmark.
- If the app is renamed, `APP_NAME` in `src/ui/wordmark.ts` changes with the product name in
  `src-tauri/tauri.conf.json` and the page title in `index.html`.
