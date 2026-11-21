# A Linux version (plan)

Planned 2026-11-21, after the owner asked what a Linux version would take, a trial build ran in WSL the same day,
and the owner said to plan it (journal, [2026-11-21](journal/2026-11-21.md)). The decision this plan asks for is
[ADR 0046](adr/0046-linux-version.md) (Proposed). This is a plan, not a decision: phases can be reordered or split.

**Target:** a touch laptop or PC, x86-64 (owner, 2026-11-21). **Ground rules:** nothing here may change how the
Windows app builds, releases or behaves; kid screens stay as they are (ADR 0003); nothing in the repo identifies
the kids or the family's machines (CLAUDE.md).

## Where it stands (2026-11-21)
- **Phase A is built** on the branch `linux/phase-a` (the owner said to start it, 2026-11-21):
  - the three faults the trial found are fixed: the finished picture's temp file has no leading dot
    (`finishedTempName`), an account without a Pictures folder is noticed at start (`picturesFolderFound`) and the
    parent area's Pictures and Add pages screens say so, and `kiosk` allows its unused code off Windows;
  - `src-tauri/tauri.linux.conf.json` (AppImage, the media framework bundled);
  - `tools/linux-smoke.mjs` and CI's `linux-appimage` job.
- **Checked on the dev machine:** unit tests, the Rust tests and the parent-area browser tests pass on Windows. In
  WSL (Ubuntu 26.04) the branch builds from scratch with no compiler warnings, and the smoke run passes against
  both the bare program and the AppImage: it starts, a fill lands, the finished picture is written, the sounds
  decode, the driving game opens.
- **Not checked: the CI job on GitHub.** It has never run. Its runner is Ubuntu 22.04, where one package has a
  different name than in WSL (`webkit2gtk-driver`); the first pull request shows whether it holds.
- **The AppImage's size:** 96 MB without the sound plugins, 171 MB in WSL with every plugin that machine had
  (including `gstreamer1.0-libav`). CI installs only the base and good sets, so its file should sit between.
- The trial's scripts are in `spikes/linux-trial/` (a record, like the other spikes).
- **Unknown until the real laptop (phase B):** the driving game's speed, touch, pen, the microphone, sounds heard.

## Phases

| Phase | What | Needs | Size |
|---|---|---|---|
| A | It builds clean on GitHub, and the known faults are fixed | Nothing: can start any time, safe on Windows | Half a day |
| B | **The gate:** the owner tries the CI AppImage on the real laptop | A, the laptop with a Linux on it | An hour of the owner's time |
| C | What differs in the app: wording, switches, microphone, restart after an update | B passed | A day |
| D | The kids' session (the lock) and the Linux setup guide | B passed; the laptop for checking | A day |
| E | Releases and in-app updates from GitHub, as on Windows | A; C for the restart | A day |
| F | The release checklist's Linux part, run once; a first published Linux release | C, D, E | Half a day, plus the owner's checks |

### A. It builds clean, and the known faults are fixed
- `src-tauri/src/main.rs`: allow unused code in `kiosk` off Windows (or gate the key rules with `cfg(windows)`
  and `cfg(test)`), so no compiler prints the warnings that crashed one.
- `src/shell/tauriFiles.ts`: the finished picture's temp file gets a name without a leading dot (`<name>.tmp`);
  a unit test pins the name. Works the same on Windows.
- The Pictures folder: when it can't be found, the app carries on without it and the parent area's Pictures and
  Add pages screens say "This account has no Pictures folder" (kid screens say nothing).
- `src-tauri/tauri.linux.conf.json` (Tauri merges it on Linux only): `bundle.targets: ["appimage"]`,
  `bundle.linux.appimage.bundleMediaFramework: true`. `tauri.conf.json` keeps `nsis`.
- The CI job in the GitHub section below (A's part of it).
- **Done when:** a pull request's checks include a Linux build whose AppImage can be downloaded from the run, and
  the smoke run shows a finished picture written.

### B. The gate (owner, on the real laptop)
Run the AppImage from phase A's CI run in the laptop's ordinary desktop. Written up as a short list in
`docs/linux-setup.md` when A lands:
- **Driving:** open it, drive for a minute on each map. Smooth enough? (The game turns its own detail down when
  frames are slow; `tools/driving-frames.html` gives numbers on the dev server if wanted.) If the laptop has an
  NVIDIA card and the window is blank or crawls, try the two settings in Tauri's Linux graphics notes first.
- **Touch:** tap, drag a brush stroke, two-finger undo, a resting palm; trace a letter; steer the car.
- **Pen**, if the laptop has one: letters with the palm resting.
- **Sound:** taps, the narrator, an engine. **Recording** a letter's name will fail until phase C; note what the
  app shows.
- **The picture:** sharp at the laptop's display scale, nothing cut off.
- **Done when:** the owner says go or no-go (L1). No-go ends the plan or reopens ADR 0046's shell choice.

### C. What differs in the app
- **Which system:** `src/shell/platform.ts` learns `windows` or `linux` from the shell (a small command returning
  the system's name), with a test; nothing else asks the user agent.
- **This laptop** (`src/parent/laptopScreen.ts`): the setup steps and the wording come from the system. On Linux:
  no *Lock the keyboard* switch (there is no hook), *Start when the computer starts* in place of the Windows
  wording, and the Linux setup steps of phase D. *Unlock the window* hides inside the kids' session (L4).
- **Microphone:** the shell answers WebKitGTK's permission request: audio capture allowed, everything else
  refused (ADR 0046 point 10). Checked by hand: record a letter's name, hear it back.
- **After an update:** the app starts itself again (`tauri-plugin-process`), since no installer does it. Inside
  the kids' session the session script starts it again (phase D).
- **Finished pictures and the pages inbox** on Linux file names: `storage/files.ts` already escapes capitals, so
  nothing collides; a browser-free unit test runs the file backend on a case-sensitive fake.
- **Done when:** unit and browser tests pass, and the laptop shows the right screen on each system.

### D. The kids' session and the setup guide
- `packaging/linux/`: a session script (starts `cage` with the AppImage, starts it again if it ends without the
  parent's Quit, ends the session after Quit) and a session entry for the sign-in screen. Installed by hand from
  the guide; no installer runs as root.
- `docs/linux-setup.md`, the twin of [laptop-setup.md](laptop-setup.md): a kids' account that is not an
  administrator; where the AppImage goes (a folder that account can write, so updates work) and `chmod +x`;
  installing `cage`; picking the session and signing the account in by itself; the standard folders
  (`xdg-user-dirs-update`); screen blanking and notifications; **what nothing blocks** (the power button, and
  whatever the sign-in screen allows); and **checking the lock**: the Super key, Alt+Tab, Alt+F4, Ctrl+Alt+F2,
  swipes from every edge, three- and four-finger swipes, then Ctrl+Shift+Q and Parent area › Quit.
- The same steps show in the app under Parent area › This laptop (phase C's screen).
- **Done when:** on the laptop, in the kids' account, none of the checks leaves the app, and Quit lands on the
  sign-in screen.

### E. Releases and updates
The GitHub section below, E's part. **Done when:** a tag drafts one release holding both systems' files, and an
installed Linux copy updates itself from a published one.

### F. The first Linux release
- [release-checklist.md](release-checklist.md) gets a Linux part mirroring each Windows part (list below).
- `README.md` says the app ships for Windows and Linux, with the Linux install lines.
- ADR 0046 accepted or changed; `docs/memory` and the code map brought up to date.

## GitHub: build and release, beside Windows
Everything Windows has today, and its Linux twin. Nothing in the left column changes except where the right says.

### Every pull request and push to main (`.github/workflows/ci.yml`)

| | Windows today (`windows-installer`) | Linux to add (`linux-appimage`), phase A |
|---|---|---|
| Runner | `windows-latest` | `ubuntu-22.04`: the oldest runner with WebKitGTK 4.1, so the AppImage runs on older systems too (L5) |
| System packages | None (WebView2 is on the runner) | `apt-get install`: `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`; `patchelf` and `gstreamer1.0-plugins-base` and `-good`, which the AppImage carries; and for the smoke run `xvfb xauth dbus-x11 webkit2gtk-driver` |
| Toolchain | Node 24, Rust stable and `rust-cache`, each pinned by commit | The same three steps, same pins; the cache is kept per system by itself |
| Rust tests | `cargo test` (the key rules) | The same; this is also the check that `kiosk.rs` compiles off Windows |
| Build | `npx tauri build --bundles nsis` | `npx tauri build --bundles appimage` |
| Kept from the run | `crayon-box-installer` (the `.exe`, 14 days), `cargo-lock` | `crayon-box-appimage` (the AppImage, 14 days). `Cargo.lock` is the same file for both; Windows keeps uploading it |
| Smoke run | None (hand checks) | `tools/linux-smoke.mjs` (from the spike): the AppImage itself on `xvfb` through WebKit's WebDriver: it starts, a fill lands, the finished picture is in the Pictures folder, the sounds decode, the driving game opens, no page errors. Its screenshots are kept when it fails |
| Signing | None (no key in ordinary CI) | None, for the same reason |

The `test` job (typecheck, unit tests, the browser suite on Chromium) already runs on Ubuntu and stays as it is.
If `main` has required checks, `linux-appimage` joins them once it has been green for a week (L8).

### A version tag (`.github/workflows/release.yml`), phase E
Today one job on Windows does everything. It becomes three, so that neither system's build can draft a release
alone:

| Job | Runs on | Does |
|---|---|---|
| `build-windows` | `windows-latest` | Today's steps up to the files: the tag matches `package.json`, the signing key is set up, `npm ci`, typecheck, unit tests, `tauri build --bundles nsis` with `createUpdaterArtifacts`, the installer copied to `CrayonBox_<version>_x64-setup.exe` with its `.sig`. Hands both to the next job as a run artifact |
| `build-linux` | `ubuntu-22.04` | The same checks and packages as the CI job, `tauri build --bundles appimage` with `createUpdaterArtifacts`, the AppImage copied to `CrayonBox_<version>_amd64.AppImage` with its `.sig` (no spaces in the name, as on Windows: GitHub turns spaces into dots). Hands both on |
| `draft-release` | `ubuntu-latest`, needs both | Fetches the four files, asks GitHub for the notes, writes one `latest.json`, writes the release text, and drafts the release with **five files**: the installer, the AppImage, their two signatures, `latest.json`. Only this job may write to the repo (`contents: write`) |

- **Secrets:** none new. Both build jobs use `TAURI_SIGNING_PRIVATE_KEY` and its password; the one public key in
  `tauri.conf.json` checks both systems' updates, and the one endpoint
  (`releases/latest/download/latest.json`) serves both.
- **`src/tools/releaseManifest.ts`:** takes each system's URL and signature (`--windows-url`, `--windows-sig`,
  `--linux-url`, `--linux-sig`) and writes `platforms` with `windows-x86_64` and `linux-x86_64`; it refuses to
  write a manifest with either missing. Its tests cover both and the refusal.
- **The release text:** today's Windows paragraph (per-user install, SmartScreen), plus a Linux one: download the
  AppImage, make it runnable (`chmod +x`), start it; setup in `docs/linux-setup.md`. Linux has no SmartScreen and
  no code signing to buy; the update signature is the same protection as on Windows.
- **Still a draft, still published by hand** (ADR 0009). Installed copies on both systems see only published
  releases. One click publishes for both, so both get tried first (L7).
- **Older versions** stay on the Releases page for both systems; going back means running an older file.
- **The first update can't be tested with one release.** As with 0.2.1 on Windows, a second small release is
  drafted and published to watch an installed Linux copy update itself.
- **Not touched:** `server.yml` (the family server's image is already Linux), the repo's visibility, the tag
  rule (`v<version>` must match `package.json`).

### In-app updates: the same as Windows (owner, 2026-11-21), phase E
A Linux copy updates itself exactly as a Windows copy does. What a parent sees does not differ at all:

| | Windows today | Linux |
|---|---|---|
| Where it looks | `latest.json` on the newest **published** release | The same file, its `linux-x86_64` entry |
| When | At start when *Check when the app starts* is on, and on *Check now* | The same (`UpdateController`, `updatesScreen.ts` and the setting are shared code) |
| What shows | Parent area › Updates: the version, the notes, *Install and restart*, progress. Kid screens never show anything | The same screen, unchanged |
| The check before installing | The download's signature against the public key built into the app | The same key, the same check |
| Installing | The NSIS installer runs by itself and opens the new version | The updater puts the new AppImage in the old one's place; the app then starts itself again (phase C) |
| Afterwards | Pictures, kids and settings untouched | The same: they live outside the AppImage |

What Linux needs for that, and nothing more:
- the `linux-x86_64` entry in `latest.json` and the AppImage's `.sig` on the release (the table above);
- the restart after installing (`tauri-plugin-process`), and the session script bringing the app back inside the
  kids' session (phase D);
- the AppImage kept where the kids' account may replace it (the setup guide's folder). If it can't be replaced,
  Updates says so in words, as it does today when a download fails;
- a copy that is not an AppImage (a developer's bare build) has nothing to replace: Updates shows the version
  and says this copy can't update itself.

`src/shell/tauriUpdater.ts` needs only the restart; `fakeUpdater.ts` and the Updates browser tests cover both
systems as they are.

### The release checklist's Linux part (phase F)
Mirrors the Windows part, on the Linux laptop, before the draft is published:
- **Make the draft:** five files attached; `latest.json` names both systems.
- **Fresh install:** the AppImage runs from the kids' account after `chmod +x` (note whether the system asked for
  FUSE); the app opens full screen on the kid picker; a colored picture is in My pictures and in
  `Pictures/Coloring Book/Art/<kid id>/` after quitting and reopening.
- **Update from the previous version:** Parent area › Updates offers it once published; *Install and restart*
  replaces the AppImage and the new version opens by itself; pictures, kids and settings are still there.
- **The lock:** phase D's checks in the kids' session; Ctrl+Shift+Q and Quit save and end the session.
- **Files and pages:** a PNG and a PDF in `Pictures/Coloring Book/Pages` become pages and move to `Added`.
- **Sound and recording:** a narrator clip is heard; a recorded letter name plays back.
- **Family sync:** as on Windows; a picture colored on one system shows on the other.

## Decisions for the owner
Each has a default the build can start on; say which to change.

| # | Decision | Recommended |
|---|---|---|
| L1 | The gate: what counts as fast enough for the driving game on the Linux laptop | The owner's eye after a minute on each map; no number unless it looks wrong |
| L2 | Which Linux the laptop runs (it decides the setup guide's exact steps) | A current Ubuntu LTS; the guide names that one and says what to look for elsewhere |
| L3 | The lock: a kids' session that is only the app (`cage`), or the app inside an ordinary desktop | The `cage` session; the ordinary desktop still works, with a weaker lock |
| L4 | *Unlock the window* inside the kids' session | Hidden there: nothing else to switch to. A parent signs in to their own account |
| L5 | The oldest system a release must run on | Whatever `ubuntu-22.04` builds for; moves when GitHub retires that runner |
| L6 | Also publish a `.deb` (smaller, but never updates itself) | No: AppImage only |
| L7 | Must a release be tried on both systems before publishing | Yes, with the short Linux list; a release with a broken Linux build reaches the Linux laptop too |
| L8 | The Linux build as a required check on pull requests | Yes, after a week of green runs |
| L9 | No built-in speech on Linux (the fallback voice stays silent) | Accept: shipped clips and a parent's recordings cover what kids hear |
| L10 | Where this sits in the [to-do list](todo.md) | Phase A now (small, safe on Windows); the rest after the gate |

## Risks
- **The driving game on WebKitGTK** is the one thing that can end this. Phase B exists to find out for an hour's
  work, before C to F are built.
- **An update inside the kids' session:** `cage` ends when its app ends, and an update restarts the app. The
  session script must bring the app back; phase D checks it with a real update.
- **The AppImage's needs:** some systems want `libfuse2` to run one. The guide says how to tell and what to
  install.
- **Two systems to check by hand** before every release, by one family. If that proves too much, L7's default
  is the thing to revisit, not the tests.
