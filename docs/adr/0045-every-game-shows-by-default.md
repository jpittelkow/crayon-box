# 0045. Every game shows on the home screen by default

- Status: Accepted (by the owner, 2026-11-21: "Show both")
- Date: 2026-11-21
- Supersedes: in [ADR 0026](0026-letter-practice.md), that Letters starts hidden until a parent turns on "Show
  Letters"; in [ADR 0044](0044-kitchen-make-it-game-pizza-first.md) (Proposed), that Kitchen starts hidden while it
  is being built. Everything else in those ADRs stands.
- Builds on: [ADR 0012](0012-multi-game-shell.md) (a parent can hide a game), [0016](0016-visual-design-language.md)
  (tiles three across).

## Context
Letters and Kitchen were both off until a parent turned them on, as games "still being tried out". Driving had
already been switched to show by default (owner, 2026-11-15). Looking for Letters and Kitchen on 2026-11-21, the
owner did not find them, and then chose to show both.

## Decision
- **Coloring, Driving, Letters and Kitchen all show on the home screen** unless a parent hides one under Settings,
  Games. A family that already switched a game on or off keeps its choice; only the untouched default changes.
- **A new game may still start hidden** (`GameEntry.startsHidden` stays), but no game does today.
- **The home screen shows three tiles across** and starts a second row for the fourth (ADR 0016 rule 6), so four
  games fit a 1280 px screen.

## Consequences
- Kids see Kitchen before it is finished: it has no speech yet, its sounds are stand-ins, and it has not been
  playtested ([kitchen-plan.md](../kitchen-plan.md)). A parent can hide it until then.
- With four games on, the home screen is never skipped unless a parent hides three of them (ADR 0012).
- The "Still being tried out." note under a game's switch in the parent area no longer shows for any game.
