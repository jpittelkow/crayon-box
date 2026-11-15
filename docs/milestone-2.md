# Milestone 2: the Windows app (plan)

The installer milestone of [ADR 0014](adr/0014-web-first-then-kiosk-installer.md): the same app, packaged with
Tauri 2 (ADR 0002), storing pictures as files (ADR 0007), locked down as a kiosk (ADR 0014), updating itself from
GitHub Releases (ADR 0009), syncing to the family server (ADR 0024), and making pages with AI (ADR 0006, 0023).
Drafted 2026-11-14, when milestone 1 was paused with the four animal themes and the artifact updates left.

This is a plan, not a decision: phases can be reordered or split. Decisions it needs are listed per phase and
at the end; anything that changes an accepted ADR gets a new ADR first (ADR 0001).

## Phases

### A. The app in a Tauri window
- **Status: done 2026-11-14.** The CI installer installed without admin rights and ran on Windows (owner).
  A `v*` tag drafts a GitHub Release with the unsigned installer (`.github/workflows/release.yml`), added
  early so there is a lasting download before phase E.
- `src-tauri/`: a Tauri 2 project that wraps the existing web app. One window, the app's own icon, the version
  taken from `package.json`.
- The web app keeps working in a browser: code that needs Windows checks whether it runs inside Tauri.
- CI gains a Windows job that builds the NSIS installer on every pull request and keeps it as a build artifact
  (not a release yet). Unsigned, per-user install.
- **Done when:** the installer from CI installs without admin rights on a Windows machine and opens on the kid
  picker; the browser version and its tests still pass.
- **Decided** (owner, 2026-11-14): **builds only in CI.** No Rust on the dev machine. Every change to the Windows
  side is tried by pushing a branch and installing the CI artifact, so Rust-side changes are kept small and the
  web side is tested in the browser first. The family laptop needs neither (ADR 0002).

### B. Files instead of browser storage
- **Status (2026-11-14):** built and unit-tested, not yet tried in the installed app. The file backend is
  `src/storage/files.ts`; the Tauri side (fs and opener plugins, finished pictures, "Open the pictures folder") is
  `src/shell/tauriFiles.ts`. Kid folders in Pictures use the kid's id (owner, 2026-11-14). Not done yet: writing
  the finished picture when the app quits (comes with *Quit app* in phase D), and rewriting it after a parent
  restores the previous version.
- A file backend behind the existing storage interface (ADR 0007): each stored item is a file under the app data
  folder; writes go to a temp file, then rename. Change records for sync (ADR 0024) live in a small index next to
  them. Games don't change.
- Finished pictures: the flattened picture with its lines is written to
  `Pictures\Coloring Book\Art\<kid>\<page>-<date-time>.png` when a kid leaves the page or the app quits, with the
  Pictures folder looked up from Windows (it is often redirected to OneDrive). "Open folder" in the parent area.
- Art made in the web version is not carried over (ADR 0014).
- **Done when:** pictures and settings survive closing and reopening the installed app, and finished pictures show
  up in the Pictures folder.
- **Decided** (owner, 2026-11-14): kid folders in Pictures are named by the kid's id (`star`, or a random id for
  kids added later), never the name (ADR 0018).

### C. Family sync (ADR 0024)
Two parts; the server part can start any time, even alongside phase A.
- **C1 status (2026-11-14):** built on branch `milestone-2/phase-c1-server`: `server/` with no npm dependencies
  (Node 24 runs the TypeScript and has `node:sqlite`), the API in `server/src/api.ts` (shared with the client),
  14 tests (`npm --prefix server test`), a Dockerfile, `server.yml` (tests, then on main publishes
  `ghcr.io/jpittelkow/crayon-box-sync`), the Unraid template `server/unraid/crayon-box-sync.xml` and
  `server/README.md`. Writes carry the revision they were based on; the server answers 409 when its copy moved on,
  and the client applies ADR 0024's rules. **Picked for the owner to confirm:** port 8787, Unraid data folder
  `/mnt/user/appdata/crayon-box-sync`, the container runs as 99:100.
- **C2 status (2026-11-14):** built on branch `milestone-2/phase-c2-client`. `src/sync/`: `api.ts` (HTTP, problems
  in words), `engine.ts` (pull since the last revision, then push; newest change wins; a picture changed on two
  devices is copied to a new picture id so both stay), `service.ts` (a round 5 s after start, then every 3 minutes,
  backing off to 30 after problems; settings in `shell/local/sync.json`). The storage layer now records each
  waiting change's `base` revision, so an ordinary edit is never mistaken for a conflict. Parent area › Family
  sync (connect with address and pairing code, last synced, problem, Sync now, Disconnect) and a one-time "Do you
  have a family server?" card at the top of Settings, in the browser version too. The Windows app's CSP now
  allows `connect-src http: https:` for the home server; the server allows any origin (CORS, token auth).
  Tested against the real server: 17 unit tests (two and three devices) and 3 browser tests (two contexts).
  Family pages (phase F) go through the same storage, so they sync too.
- **C1, the server:** `server/`, TypeScript on Node with SQLite and the files on disk, API under `/api/v1`, a
  pairing code on first start, a one-page status screen. A Dockerfile; CI publishes the image to GitHub's
  container registry; an Unraid template in the repo. Its own tests.
- **C2, the client:** a sync engine under the storage interface: send waiting changes, fetch changes since the
  last revision, newest change wins per file, pictures changed on two devices are kept as two pictures,
  deletions are remembered. Runs in the background with backoff; kid screens never wait for it. Parent area:
  server address and pairing code, "last synced", problems in words. The first-run question "Do you have a
  family server?".
- **Done when:** the installed app and the browser version, paired to one server, end up with the same kids,
  settings and pictures, including after one was offline; and a fresh install restores everything.
- **Needs:** the server's port and where it runs on Unraid; whether family pages (phase F) sync too.

### D. Kiosk lock (ADR 0014)
- **Status (2026-11-14):** built on branch `milestone-2/phase-d-kiosk`; the key rules are unit-tested in Rust
  (`cargo test`, now also run in CI) and the web side in the browser with a fake (`?fake-kiosk`). Not yet tried on
  the family laptop. `src-tauri/src/kiosk.rs` (hook, ignored close, quit), `src/shell/kiosk.ts` (what applies
  when; settings kept under `local/`, which sync skips, ADR 0024), `tauriKiosk.ts`, `src/parent/laptopScreen.ts`
  (Parent area › This laptop: Quit, the switches, start at sign-in, the setup guide), and
  [laptop-setup.md](laptop-setup.md) with the checklist. The hook only starts the first time the lock is needed,
  so with the lock off there is no hook at all. Quitting leaves the open screen first, which writes the finished
  picture (phase B's leftover). Defaults: full screen on, keyboard lock on, start at sign-in off.
- Borderless full screen that can't be resized or minimized; the close request is ignored; *Quit app* in the
  parent area and `Ctrl+Shift+Q` close it.
- The low-level keyboard hook (a small Rust module): swallows the Windows key, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4,
  F11 and ordinary keys while the app has focus; lets `Ctrl+Shift+Q` through, and the driving keys while the
  driving game is open (ADR 0021); released in the parent area.
- Parent area switches: keep full screen, lock the keyboard (off if antivirus flags it), start at sign-in.
- The laptop setup guide (kids' Windows account, touch gestures off, Do not disturb), as a doc and a parent-area
  page.
- **Done when:** the manual checklist passes on the family laptop: no way out except the parent area,
  `Ctrl+Shift+Q`, Ctrl+Alt+Del and Win+L.

### E. Updates and releases (ADR 0009)
- **Status (2026-11-14):** built on branch `milestone-2/phase-e-updates`, unit- and browser-tested with a fake
  updater; not yet through a real release. Waiting on the signing key (below). `src/shell/updates.ts` (checks,
  installs, the *Check for updates when the app starts* setting, on by default), `src/shell/tauriUpdater.ts`
  (the plugin), `src/parent/updatesScreen.ts` (the Updates screen, Windows app only, with a dot in the nav while
  a newer version waits), `src/tools/releaseManifest.ts` (writes `latest.json`, with GitHub's generated notes
  turned into plain lines). On the dev server, `?fake-updates=available|none|offline|broken` stands in for the
  updater. The release names the installer `CrayonBox_<version>_x64-setup.exe` (GitHub would turn the spaces
  into dots).
- **Signing key, one time (owner):** `npx tauri signer generate -w <a file outside the repo>`, with a password.
  Put the private key file's contents in the repo secret `TAURI_SIGNING_PRIVATE_KEY` and the password in
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; keep the file and the password in the password manager. The public key
  (the `.pub` file) replaces `REPLACE_WITH_UPDATER_PUBLIC_KEY` in `src-tauri/tauri.conf.json`; `release.yml`
  refuses to run until both are in place.
- **To finish:** release `v0.1.1` (or similar) and install it, then release the next version, publish it, and
  update from the parent area. Commit the `Cargo.lock` from the CI build (it needs `tauri-plugin-updater`).
- The Tauri updater plugin, checking `latest.json` on the Releases page at start-up (a parent switch) and on
  *Check now*. The parent area's Updates screen: version, release notes, *Install and restart*.
- The release workflow: a `v*` tag builds the installer, its signature and `latest.json` into a **draft**
  release; a parent tries it, then publishes it. The workflow exists since phase A with the unsigned installer
  only; this phase adds the signature and `latest.json`.
- **Done when:** a laptop on version N updates itself to N+1 from inside the parent area.
- **Needs (your hands):** creating the updater signing key pair, storing the private key and password as GitHub
  secrets, and a backup copy in your password manager. Losing it means every installed copy has to be
  reinstalled by hand.

### F. Family pages from files (ADR 0005)
- **Status (2026-11-14):** built on branch `milestone-2/phase-f-family-pages`. **Decided** (Claude, to keep going;
  the open "Needs" below): family pages live in the coloring game's storage (`family/<id>/page.png` and
  `page.json`), so they sync like everything else; the Pictures folder is only an inbox. `catalog.ts` merges them
  with the built-in pages ("Our pages" first in the theme strip); `importPage.ts` (PNG, JPG, SVG, the first page
  of a PDF through pdf.js, loaded only there; then clean-up, page check, page.png); Parent area › Add pages
  (preview, what the check found, name, theme); Page library lists family pages with Hide and Remove;
  `folderImport.ts` turns files in `Pictures\Coloring Book\Pages` (a theme-named subfolder picks the theme) into
  pages 3 s after start and moves them to `Added` or `Not added`. 5 unit tests, 5 browser tests with real files.
- *Import* in the parent area: PNG, JPG, SVG or the first page of a PDF, run through the clean-up step and the
  page check (built in milestone 1), previewed, then added to a theme or "Our pages".
- Loose files dropped into `Pictures\Coloring Book\Pages\<theme>\` are turned into pages at the next launch.
- "Our pages" joins the theme strip; family pages can be hidden like built-in ones.
- **Done when:** a scanned drawing becomes a page the kids can fill, from both the parent area and the folder.
- **Needs:** where family pages live now that sync exists. ADR 0005 puts them in the Pictures folder; syncing
  them means keeping them (or a copy) under the app's storage.

### G. AI page maker (ADR 0006, 0023)
- The OpenRouter key, stored in Windows Credential Manager through a small Rust command, never in a file.
- The AI setup screen: key, model (from OpenRouter's list), the account privacy settings.
- *From a photo* (ADR 0006) and *From an idea*: generate, or draw as SVG (ADR 0023). Every result goes through the
  clean-up, the page check and a preview before *Add to library*. *Search* waits until a search service is chosen.
- Also the tool for the four animal themes left from milestone 1 (ADR 0022), if they aren't made before.
- **Done when:** a parent turns a photo and a typed idea into pages the kids can fill.
- **Needs:** the default image model (after a quality test with a few photos); the search service.

### H. Ready for the family
- The manual release checklist (ADR 0015): install, update from the previous version, kiosk lock and keyboard
  hook, laptop setup.
- The first real release, installed on the family laptop.
- **Done when:** the kids use the installed app, and the web version is retired (ADR 0014).

## Order and what can run side by side
```
A ──► B ──► C2 ─────────────────────────┐
│     └───► F ──► G                     ├──► H
├───► D                                 │
└───► E ────────────────────────────────┘
C1 (server) can start any time.
```
- Suggested order: **A, B, C (sync), D, E, F, G, H.** Sync comes right after file storage, as ADR 0024 decided.
- D and E only need A, so they can run beside B and C, in their own sessions.
- The first install on the family laptop is possible after A, B, D and E. F and G arrive later as updates.

## Decisions to make along the way
| When | Decision |
|---|---|
| Before A | ~~Rust on the dev machine, or CI-only builds~~: CI-only (2026-11-14) |
| Before B | ~~Kid folder names in `Pictures\Coloring Book\Art`: names or ids~~: ids (2026-11-14) |
| Before C | The server's port and place on Unraid |
| Before D | The family laptop's model: screen size and shape (ADR 0004, 0016) and graphics (ADR 0021) |
| Before E | Creating and backing up the updater signing key (your hands). A paid code-signing certificate stays optional (ADR 0009) |
| Before F | Where family pages live, and whether they sync |
| Before G | Default AI image model; search service for ideas |
