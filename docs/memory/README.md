# Memory

Durable facts that should survive between sessions and are not obvious from the code, git history or ADRs.
Read all of these at the start of a session; they are kept short on purpose.

| File | What it holds |
|---|---|
| [project-state.md](project-state.md) | Current phase, what exists, what is next |
| [preferences.md](preferences.md) | How the owner wants things built and how they like to work |
| [open-questions.md](open-questions.md) | Decisions still waiting on the owner |
| [gotchas.md](gotchas.md) | Non-obvious traps, workarounds and lessons learned |

## Rules for memory files
- **One topic per file**, bullets over prose. Add a new file only when a topic doesn't fit an existing one, and
  add it to the table above.
- **Update in place.** Memory is the current truth, not a history. When a fact changes, rewrite it; when it stops
  being true, delete it. History belongs in the [journal](../journal/README.md).
- **Don't duplicate.** If an ADR, the code or git already records it, link to it instead.
- **Absolute dates** (`2026-11-14`), and note the date a fact was last confirmed when it may go stale.
- **Privacy rule** from [CLAUDE.md](../../CLAUDE.md) applies: no kids' names or specific identifiers.
