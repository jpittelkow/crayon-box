# 0003. Toddler-first interaction rules

- Status: Accepted (by the owner, 2026-11-14); swatch size superseded by [0019](0019-bigger-coloring-page.md)
- Date: 2026-11-14

## Context
Users are 4 and under: they can't read, tap with a whole finger, rest palms on the screen, and press things by
accident. A parent sets things up.

## Decision
All kid screens follow these rules:
1. **No text.** Every control is an icon. Feedback is a sound plus a small bounce.
2. **Big targets:** at least 80 CSS px with 12 px gaps; buttons fire on pointer-up inside the button.
   To check in playtests: small fingers often slide off before lifting, so pick buttons (colors, sizes, tools) may
   need to fire on touch-down instead. Buttons that change a lot (undo, start over, back) stay on pointer-up.
3. **Every finger paints.** Each touch draws its own stroke (up to 4 at once), so a resting hand or a thumb
   gripping the screen edge never blocks painting, and two kids can color together. Touches with a very large
   contact area (palms) are ignored where the screen reports contact size.
4. **No escape hatches.** `touch-action: none`, pinch-zoom, swipe navigation, right-click menu and text selection
   are disabled, and so is every keyboard shortcut except `Ctrl+Shift+Q`, the parent's quit shortcut (ADR 0008).
   The app runs full screen.
5. **A fixed set of choices, all on screen:** 23 colors + rainbow, 3 brush sizes as dots, 3 tools (bucket, brush,
   eraser), a two-way coloring mode (color anywhere or stay in the lines, ADR 0004), undo, start over. Nothing is
   in a menu, a second page or a color mixer. The owner asked for many more colors than the first 12
   (2026-11-14); 24 swatches is what fits at the minimum target size on the reference screen (ADR 0016).
6. **Nothing is lost:** autosave after every action; "start over" is undoable; reopening a picture keeps the
   previous version (ADR 0007).
7. Anything destructive or outside the app (delete, settings, quit) lives in the parent area (ADR 0008).

## Consequences
- Simple, predictable UI; some power features (zoom, color mixing) are left out on purpose.
- Letting every finger paint means a resting hand can leave a stray mark where the screen doesn't report contact
  size. Undo removes it, and that is a better failure than painting being blocked.
- Every new screen is checked against this list before merging.
