# Linux trial

A throwaway test, not part of the app: it built the app for Linux and drove the built program under WebKitGTK, to
answer "what would a Linux version take" (2026-11-21). Kept as the record behind
[ADR 0046](../../docs/adr/0046-linux-version.md); the plan is [docs/linux-plan.md](../../docs/linux-plan.md), whose
phase A turns `probe.mjs` into CI's smoke run.

Run on a Linux system or a WSL distro (it was Ubuntu 26.04 under WSL), as root or with sudo for the first step:

```bash
bash spikes/linux-trial/setup.sh                  # packages, from the distro's own archive
bash spikes/linux-trial/build.sh /path/to/repo    # a copy in ~/crayon-trial, the program, an AppImage and a .deb
bash spikes/linux-trial/probe.sh                  # the program on a headless display; screenshots in ./shots
```

- `probe.mjs` talks to `WebKitWebDriver` directly with `webkitgtk:browserOptions` naming the program, and
  `TAURI_WEBVIEW_AUTOMATION=true` in the driver's environment. That is all `tauri-driver` does on Linux.
- From WSL, run the scripts with a Linux-only `PATH` (they set one): Windows programs on WSL's `PATH` (a Windows
  `npm`) swallow the script when it is piped in.
- Phase A (2026-11-21) fixed what the trial found and made `tools/linux-smoke.mjs` from `probe.mjs`: that is the
  one CI runs. `probe.mjs` stays as the wider look (engine features, frame times).
- What it found and what it could not answer is in the journal entry for 2026-11-21. In short: it builds and runs;
  finished pictures were refused (a dot-named temp file); the headless display draws in software, so its frame
  rate means nothing; the test driver grants the microphone by itself, so recording is not tested by it.
