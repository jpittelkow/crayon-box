#!/bin/bash
# Copies a checkout onto the Linux file system and builds it: the bare program, then an AppImage and a .deb.
#   build.sh <path to the repo>      e.g. the Windows checkout under /mnt/c/... from WSL; it is only read.
# The copy lives in $TRIAL (default ~/crayon-trial). Logs: build.log and bundle.log there.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -e
SRC="${1:?Give the path to the repo}"
TRIAL="${TRIAL:-$HOME/crayon-trial}"
rm -rf "$TRIAL"; mkdir -p "$TRIAL"
tar -C "$SRC" --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./src-tauri/target \
  --exclude=./playwright-report --exclude=./test-results --exclude=./spikes --exclude=./.claude \
  --exclude=./server/node_modules -cf - . | tar -C "$TRIAL" -xf -
cd "$TRIAL"
npm ci --no-audit --no-fund
# Found 2026-11-21: off Windows the key rules in kiosk.rs have no caller, and Ubuntu's rustc 1.93.1 crashes while
# printing those dead-code warnings. Until the repo has the fix (linux-plan.md, phase A), the copy gets it here.
grep -q 'allow(dead_code)' src-tauri/src/main.rs ||
  sed -i 's/^mod kiosk;\r\?$/#[cfg_attr(not(windows), allow(dead_code))]\nmod kiosk;/' src-tauri/src/main.rs
npx tauri build --no-bundle > build.log 2>&1 || { tail -30 build.log; exit 1; }
ls -la src-tauri/target/release/crayon-box
# NO_STRIP: on a new distro the packager's own `strip` is too old for the system's libraries. The AppImage's sound
# bundling (`bundleMediaFramework`, since phase A) needs `patchelf`.
APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=true npx tauri build --bundles appimage,deb > bundle.log 2>&1 || { tail -30 bundle.log; exit 1; }
find src-tauri/target/release/bundle -maxdepth 2 -type f \( -name '*.AppImage' -o -name '*.deb' \) -exec ls -la {} \;
