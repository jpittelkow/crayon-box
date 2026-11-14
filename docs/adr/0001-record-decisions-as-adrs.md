# 0001. Record decisions as ADRs

- Status: Accepted
- Date: 2026-11-14

## Context
The app will be built over several sessions, possibly by different people or AI threads. Decisions need to survive
between them and explain *why*, not only *what*.

## Decision
Keep one Markdown ADR per decision in `docs/adr/`, numbered, using the sections Context, Decision, Consequences.
A changed decision gets a new ADR that supersedes the old one; old ADRs are not rewritten.

## Consequences
- Anyone can see why the app works the way it does before changing it.
- Small overhead per decision.
