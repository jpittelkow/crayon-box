# Journal

A dated log of work sessions: what was done, what was decided, what is next. Unlike [memory](../memory/README.md),
the journal is append-only history. Newest entry is the place to pick up from.

## Rules
- One file per day: `YYYY-MM-DD.md`. Several sessions on one day go in the same file as separate sections.
- Append; don't rewrite past entries (a correction is a new note that says what changed).
- Keep it brief: bullets, links to ADRs, files and commits instead of pasting content.
- **Privacy rule** from [CLAUDE.md](../../CLAUDE.md) applies: no kids' names or specific identifiers. When noting
  feedback from playtests, say "a kid" or "the youngest", not a name.

## Template

```markdown
# YYYY-MM-DD

## Session: <short title>
**Done**
- ...

**Decided**
- ... (link the ADR if one was written or changed)

**Learned / playtest notes**
- ...

**Next**
- ...
```

## Entries
- [2026-11-14](2026-11-14.md): design ADRs, memory and journal set up; web app scaffold and coloring engine; new
  picture flow, kid names and photos, parent area; milestone 1 phases A and B; racing game ADR proposed;
  three.js and Babylon.js test, with water
- [2026-11-15](2026-11-15.md): sound options, the milestone 3 plan for the driving game, driving to a spot (ADR 0031); letters research and plan (ADR 0037 proposed); words research and a draft ADR 0039
- [2026-11-16](2026-11-16.md): the overnight build of to-do sections 2, 4 and 5, released as 0.9.0
- [2026-11-21](2026-11-21.md): ideas for "make a thing" games; the Kitchen game designed (ADR 0044 proposed, kitchen-plan.md), mocked up and its pizza built on a branch
