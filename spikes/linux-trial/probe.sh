#!/bin/bash
# Runs the built program on a headless X display and probes it with probe.mjs. The app opens full screen and
# ignores close requests, so it is kept off any real desktop: under WSL, WSLg's Wayland is switched off for the run.
# It gets a home folder of its own, wiped each time, with a Pictures folder set up (without one the app has
# nowhere to put finished pictures). Screenshots and report.json land in $SHOTS (default ./shots).
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HERE="$(cd "$(dirname "$0")" && pwd)"
export TRIAL="${TRIAL:-$HOME/crayon-trial}"
export SHOTS="${SHOTS:-$HERE/shots}"
unset WAYLAND_DISPLAY DISPLAY
export GDK_BACKEND=x11
export XDG_RUNTIME_DIR=/tmp/xdg-crayon-trial
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
export HOME="$TRIAL-home"
rm -rf "$HOME"; mkdir -p "$HOME/.config"
printf 'XDG_PICTURES_DIR="$HOME/Pictures"\n' > "$HOME/.config/user-dirs.dirs"
pkill -f WebKitWebDriver 2>/dev/null; pkill -x crayon-box 2>/dev/null
cp "$HERE/probe.mjs" "$TRIAL/probe.mjs"
cd "$TRIAL"
timeout 600 dbus-run-session -- xvfb-run -a -s "-screen 0 1920x1080x24" node probe.mjs 2>&1 |
  grep -v -E "^$|dbus-daemon|SpiRegistry|libEGL" | cut -c1-1500
echo "--- exit ${PIPESTATUS[0]}"
pkill -f WebKitWebDriver 2>/dev/null; pkill -x crayon-box 2>/dev/null
echo "--- what the app wrote"
find "$HOME/Pictures" "$HOME/.local/share/org.crayonbox.coloring/store" -maxdepth 4 2>/dev/null | sed "s|$HOME|~|" | head -30
