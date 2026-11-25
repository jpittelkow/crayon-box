#!/bin/bash
# Build tools for a Tauri 2 Linux build, all from Ubuntu's archive: Tauri's documented packages, Node and Rust, a
# headless display, WebKit's WebDriver and the sound plugins. Run as root (or with sudo) inside the trial system.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export DEBIAN_FRONTEND=noninteractive
set -e
apt-get update -q
apt-get install -y -q --no-install-recommends \
  build-essential curl wget file pkg-config ca-certificates patchelf \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  nodejs npm cargo rustc \
  xvfb xauth dbus-x11 \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-libav
# The driver's package is `webkitgtk-webdriver` on Ubuntu 26.04 and `webkit2gtk-driver` on older releases.
apt-get install -y -q --no-install-recommends webkitgtk-webdriver || apt-get install -y -q --no-install-recommends webkit2gtk-driver
node --version; cargo --version; pkg-config --modversion webkit2gtk-4.1; command -v WebKitWebDriver
