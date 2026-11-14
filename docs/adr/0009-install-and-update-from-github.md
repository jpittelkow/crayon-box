# 0009. Install and in-app updates from GitHub Releases

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
Jeff wants to install the app from GitHub and update it from inside the app, without developer tools on the
laptop.

## Decision
- **Releases are only for the Windows installer** (decided by the owner, 2026-11-14). Each release holds the
  installer, its signature and `latest.json`, and nothing else: no web build, no container image. The web app of
  milestone 1 runs locally only (ADR 0014).
- **Build:** a GitHub Actions workflow (`tauri-apps/tauri-action`) on a `windows-latest` runner builds the NSIS
  installer whenever a version tag (`v*`) is pushed, and creates a **draft** GitHub Release (`releaseDraft: true`)
  with the installer, its signature, and `latest.json`.
- **Publishing:** the draft is installed and tried by hand first (ADR 0015), then published. The updater only
  sees published releases, so a broken build never reaches the laptop on its own. Older installers stay on the
  Releases page; going back a version means running an older installer.
- **Signing updates:** Tauri's updater signing key pair. The private key and its password live in GitHub Actions
  secrets, with a backup copy in the owner's password manager; the public key is built into the app. The app
  refuses any update whose signature doesn't match. If the private key is lost, installed copies can never
  update again and need a manual reinstall with a new key, which is why the backup matters.
- **First install:** download the installer from the Releases page and run it (per-user install, no admin needed).
- **In-app update:** Tauri updater plugin checks
  `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` at startup (if enabled) or on
  *Check now*. The parent area shows the version, the release notes, and *Install and restart*. Kid screens never
  show update prompts.
- **Repo visibility:** the updater downloads release files without logging in, so the releases must be public.
  The repo is public (ADR 0013), so releases are published in the same repo and need no extra setup. Nothing
  secret is in the code (the OpenRouter key is entered on the laptop, ADR 0006).
- **Windows SmartScreen:** without a paid code-signing certificate, Windows shows "Windows protected your PC"
  on first install (More info → Run anyway). In-app updates don't trigger it again. A certificate can be added
  later.

## Consequences
- A tag push plus one "publish" click ships a new version to the laptop; the family taps one button to update.
- Pages added to the repo (ADR 0005) reach the laptop through the same updates.
