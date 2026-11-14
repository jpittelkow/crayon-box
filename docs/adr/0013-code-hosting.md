# 0013. Code hosting: GitHub (Gitea optional mirror)

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
Jeff is fine with a GitHub repo, and also has a self-hosted Gitea. Builds need a Windows machine (ADR 0009), and
the in-app updater needs a release URL the laptop can reach without logging in.

## Decision
Use GitHub as the main repo: hosted Windows runners build the installer, and public release downloads work
for the updater from anywhere. Gitea can mirror the repo if wanted. Moving to Gitea alone later is possible
(Gitea Actions plus a self-hosted Windows runner, and the updater URL pointed at Gitea releases) but needs that
runner and a Gitea reachable from the laptop.

Visibility: **one public repo** (decided by the owner, 2026-11-14). Code, releases, built-in pages, the project
memory and the session journal all live in it. A private code repo plus a public releases-only repo was
considered and turned down as more setup than it is worth.

## Consequences
- No build machine to maintain, and builds on hosted runners are free for a public repo.
- Everything in the repo is visible to anyone, including the memory and journal. The privacy rule in `CLAUDE.md`
  is the only thing keeping the kids' names and identifiers out, so it applies to every commit.
- Commit history is public too, including each commit's author name and email.
- No secrets are in the repo (ADR 0006, 0009).
