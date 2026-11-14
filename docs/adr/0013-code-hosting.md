# 0013. Code hosting: GitHub (Gitea optional mirror)

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff is fine with a GitHub repo, and also has a self-hosted Gitea. Builds need a Windows machine (ADR 0009), and
the in-app updater needs a release URL the laptop can reach without logging in.

## Decision
Use GitHub as the main repo: free hosted Windows runners build the installer, and public release downloads work
for the updater from anywhere. Gitea can mirror the repo if wanted. Moving to Gitea alone later is possible
(Gitea Actions plus a self-hosted Windows runner, and the updater URL pointed at Gitea releases) but needs that
runner and a Gitea reachable from the laptop.

Visibility: a public repo is simplest (ADR 0009). A private code repo plus a public releases-only repo also works.

## Consequences
- No build machine to maintain.
- Code (and built-in pages) are visible if the repo is public; no secrets are in it.
