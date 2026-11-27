#!/bin/sh
# Keeps the "mac-app" release on the newest Mac companion app: one asset, passwords-plus-mac.dmg,
# which the extension's "Download for Mac" links download directly (src/config.ts). Run by CI
# after a companion release. A companion release also takes GitHub's "Latest" mark, so this gives
# it back to the newest extension release, where the README sends people for the extension.
#
# Usage: scripts/release/mac-app.sh VERSION DMG    (gh must be signed in, or GH_TOKEN and GH_REPO set)

set -eu
version="${1:?usage: mac-app.sh VERSION DMG}"
dmg="${2:?usage: mac-app.sh VERSION DMG}"

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
notes="The newest Mac companion app: [companion-v$version](https://github.com/$repo/releases/tag/companion-v$version). Open the disk image and drag Passwords Plus to Applications."

staging="$(mktemp -d)"
cp "$dmg" "$staging/passwords-plus-mac.dmg"
if gh release view mac-app >/dev/null 2>&1; then
    gh release upload mac-app "$staging/passwords-plus-mac.dmg" --clobber
    gh release edit mac-app --notes "$notes" --latest=false
else
    gh release create mac-app "$staging/passwords-plus-mac.dmg" --title "Mac app" --notes "$notes" --latest=false
fi
rm -rf "$staging"

extension="$(gh release list --limit 50 --json tagName --jq '[.[] | select(.tagName | startswith("extension-v"))][0].tagName')"
if [ -n "$extension" ]; then gh release edit "$extension" --latest; fi
echo "mac-app now has companion-v$version"
