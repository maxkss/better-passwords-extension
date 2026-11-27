#!/bin/sh
# CI: switches to the newest Xcode 26 or later on the runner. The app's icon is an Icon Composer
# document (apps/extension/assets/AppIcon.icon), which actool compiles only from Xcode 26 on, and
# only on macOS 26 or later (on macOS 15 its asset catalog agent crashes), so the companion jobs run
# on macos-26; this makes sure its newest Xcode is the one in use.
set -eu
xcode="$(ls -d /Applications/Xcode_[2-9][0-9]*.app 2>/dev/null | grep -v -i beta | sort -V | tail -1 || true)"
if [ -z "$xcode" ]; then
    echo "no Xcode 26 or later on this runner" >&2
    ls -d /Applications/Xcode*.app >&2 || true
    exit 1
fi
sudo xcode-select -s "$xcode/Contents/Developer"
xcodebuild -version
