# 0009. Install and in-app updates from GitHub Releases

- Status: Proposed
- Date: 2026-11-14

## Context
Jeff wants to install the app from GitHub and update it from inside the app, without developer tools on the
laptop.

## Decision
- **Build:** a GitHub Actions workflow (`tauri-apps/tauri-action`) on a `windows-latest` runner builds the NSIS
  installer whenever a version tag (`v*`) is pushed, and publishes a GitHub Release with the installer, its
  signature, and `latest.json`.
- **Signing updates:** Tauri's updater signing key pair. The private key lives only in GitHub Actions secrets;
  the public key is built into the app. The app refuses any update whose signature doesn't match.
- **First install:** download the installer from the Releases page and run it (per-user install, no admin needed).
- **In-app update:** Tauri updater plugin checks
  `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` at startup (if enabled) or on
  *Check now*. The parent area shows the version, the release notes, and *Install and restart*. Kid screens never
  show update prompts.
- **Repo visibility:** the updater downloads release files without logging in, so the releases must be public.
  Either the repo is public, or the code stays in a private repo and the workflow publishes releases to a second,
  public releases-only repo. Nothing secret is in the code either way (the OpenRouter key is entered on the
  laptop, ADR 0006).
- **Windows SmartScreen:** without a paid code-signing certificate, Windows shows "Windows protected your PC"
  on first install (More info → Run anyway). In-app updates don't trigger it again. A certificate can be added
  later.

## Consequences
- One tag push ships a new version to the laptop; the family taps one button to update.
- Pages added to the repo (ADR 0005) reach the laptop through the same updates.
