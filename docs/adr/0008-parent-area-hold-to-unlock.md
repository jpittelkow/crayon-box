# 0008. Parent area behind hold-to-unlock

- Status: Proposed
- Date: 2026-11-14

## Context
Settings, AI, deleting, printing, updates and quitting must be out of reach of toddlers but quick for a parent.
A PIN is easy to forget and annoying on a shared family laptop.

## Decision
- A small, low-contrast lock button sits in the corner of the page picker.
- Opening the parent area requires **pressing and holding the lock for 3 seconds** while a ring fills. Releasing
  early cancels. Optional extra: a PIN can be turned on in settings.
- The parent area is a normal, text-based UI: Settings, Page library, Add a page (AI), Updates, Back to
  coloring, Quit app.
- `Ctrl+Shift+Q` also quits, for a parent at the keyboard. Kiosk lock details: ADR 0014.

## Consequences
- Toddlers tapping randomly can't get in; preschoolers might learn the trick eventually, which is when the PIN
  option helps.
