# 0008. Parent area behind a hold-then-read gate

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
Settings, AI, deleting, printing, updates and quitting must be out of reach of toddlers but quick for a parent.
A PIN is easy to forget and annoying on a shared family laptop. A hold alone is too weak: toddlers rest fingers
on the screen for seconds at a time, and a ring that fills invites them to keep holding. The kids can't read,
which a gate can use.

## Decision
- A small, low-contrast lock button sits in the corner of the shell's screens (the kid picker and the home
  screen, ADR 0012), not inside games.
- Opening the parent area takes two steps:
  1. **Press and hold the lock for 1 second**, with no animation, so stray taps do nothing.
  2. **Read and tap:** the gate shows three numbers as words ("seven, three, nine", different every time) above
     a number pad. Tapping those digits in order opens the parent area. A wrong digit, or 10 seconds without a
     tap, goes back to the kid screen.
- Optional extra for when a kid learns to read: a PIN can be turned on in settings and replaces step 2.
- The parent area locks itself and returns to the kid screens after 3 minutes without a touch.
- The parent area is a normal, text-based UI: Settings, Page library, Add a page (AI), Updates, Back to
  coloring, Quit app.
- `Ctrl+Shift+Q` also quits, for a parent at the keyboard. It is the app's only keyboard shortcut (ADR 0003),
  and the kiosk keyboard lock lets it through (ADR 0014).

## Consequences
- Kids who can't read can't get in, even by holding or by copying what they saw a parent do, because the numbers
  change each time. The PIN option covers the day one of them can read.
- No PIN to forget by default.
- A parent who walks away leaves the parent area open for at most 3 minutes.
