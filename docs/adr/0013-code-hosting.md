# 0013. Code hosting: GitHub (Gitea optional mirror)

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff is fine with a GitHub repo, and also has a self-hosted Gitea. Builds need a Windows machine (ADR 0009), and
the in-app updater needs a release URL the laptop can reach without logging in.

## Decision
Use GitHub as the main repo: hosted Windows runners build the installer, and public release downloads work
for the updater from anywhere. Gitea can mirror the repo if wanted. Moving to Gitea alone later is possible
(Gitea Actions plus a self-hosted Windows runner, and the updater URL pointed at Gitea releases) but needs that
runner and a Gitea reachable from the laptop.

Visibility: **a private code repo plus a public releases-only repo** (ADR 0009). The code repo now also holds
the project memory and a session journal with playtest notes about a family's kids. The privacy rule in
`CLAUDE.md` keeps names and identifiers out of them, but keeping the repo private is a second layer. A single
public repo is simpler and remains possible if the owner prefers it.

## Consequences
- No build machine to maintain.
- Only the installers are public. The code, built-in pages, memory and journal are not.
- A private repo has a monthly allowance of free build minutes rather than unlimited ones. A few releases a
  month should fit comfortably; check the current allowance when setting up the workflow.
- Publishing to a second repo needs one extra token and a little more workflow setup.
