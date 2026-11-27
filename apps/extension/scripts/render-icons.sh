#!/bin/sh
# Renders the extension's icons in public/icon from assets/AppIcon.icon, the Icon Composer
# document the companion app's icon is compiled from too. Needs Xcode 26 or later (ictool).
set -eu
cd "$(dirname "$0")/.."
ictool="$(xcode-select -p)/../Applications/Icon Composer.app/Contents/Executables/ictool"
for size in 16 32 48 96 128; do
    "$ictool" assets/AppIcon.icon --export-image --output-file "public/icon/$size.png" \
        --platform macOS --rendition Default --width "$size" --height "$size" --scale 1 >/dev/null
done
echo "rendered public/icon from assets/AppIcon.icon"
