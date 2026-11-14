# 0003. Toddler-first interaction rules

- Status: Proposed
- Date: 2026-11-14

## Context
Users are 4 and under: they can't read, tap with a whole finger, rest palms on the screen, and press things by
accident. A parent sets things up.

## Decision
All kid screens follow these rules:
1. **No text.** Every control is an icon. Feedback is a sound plus a small bounce.
2. **Big targets:** at least 80 CSS px with 12 px gaps; buttons fire on pointer-up inside the button.
3. **One finger.** The first active pointer paints; other touches are ignored until it lifts (palm rejection).
4. **No escape hatches.** `touch-action: none`, pinch-zoom, swipe navigation, right-click menu, text selection and
   keyboard shortcuts (except the parent unlock) are disabled. The app runs full screen.
5. **Few choices:** 12 colors + rainbow, 3 brush sizes as dots, 3 tools (bucket, brush, eraser), undo, start over.
6. **Nothing is lost:** autosave after every action; "start over" is undoable.
7. Anything destructive or outside the app (delete, settings, quit) lives in the parent area (ADR 0008).

## Consequences
- Simple, predictable UI; some power features (zoom, color mixing) are left out on purpose.
- Every new screen is checked against this list before merging.
