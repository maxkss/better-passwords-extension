#!/bin/sh
# Builds the companion as a disk image in dist/updates. Run by semantic-release in CI.
#
# Usage: scripts/release.sh VERSION
#
# Without a Developer ID (the default for this fork), the app is ad hoc signed and not notarized:
# it's free to publish, and macOS opens it once the user allows it (System Settings › Privacy &
# Security › Open Anyway, see docs/companion.md). With these secrets set, it's signed with the
# Developer ID and notarized instead, and an update appcast is written:
#   MACOS_SIGN_IDENTITY       e.g. "Developer ID Application: Name (TEAMID)", already in the keychain
#   NOTARY_KEY_PATH           App Store Connect API key (.p8) for notarytool
#   NOTARY_KEY_ID, NOTARY_ISSUER
#   SPARKLE_PRIVATE_KEY       Sparkle's EdDSA key (generate_keys -x); signs the update and the appcast,
#                             for an app whose Info.plist has SUFeedURL and SUPublicEDKey

set -eu
cd "$(dirname "$0")/.."

version="${1:?usage: release.sh VERSION}"
identity="${MACOS_SIGN_IDENTITY:-}"
if [ -n "$identity" ]; then
    : "${NOTARY_KEY_PATH:?notarization is required for a Developer ID release}"
    : "${NOTARY_KEY_ID:?}"
    : "${NOTARY_ISSUER:?}"
fi

repo="https://github.com/maxkss/better-passwords-extension"
app="dist/Passwords Plus.app"
updates="dist/updates"
dmg="$updates/passwords-plus-$version-mac.dmg"

notarize() {
    xcrun notarytool submit "$1" --key "$NOTARY_KEY_PATH" --key-id "$NOTARY_KEY_ID" --issuer "$NOTARY_ISSUER" --wait
}

# Stapling downloads the ticket from Apple's CDN, which CI runners sometimes lose the connection to
# (stapler error 68) or ask for before it's published (error 65). Both pass on a retry.
staple() {
    for wait in 10 20 40 80; do
        xcrun stapler staple "$1" && return
        echo "stapling failed, retrying in ${wait}s" >&2
        sleep "$wait"
    done
    xcrun stapler staple "$1"
}

scripts/bundle.sh --version "$version" --sign "${identity:--}"

# notarize the app and staple its ticket, so it also opens offline once it's out of the disk image
if [ -n "$identity" ]; then
    ditto -c -k --keepParent "$app" dist/notarize.zip
    notarize dist/notarize.zip
    rm dist/notarize.zip
    staple "$app"
    spctl --assess --type execute --verbose "$app"
fi

# the disk image: the app next to a link to Applications, to drag it onto
rm -rf "$updates"
mkdir -p "$updates"
staging="$(mktemp -d)"
ditto "$app" "$staging/Passwords Plus.app"
ln -s /Applications "$staging/Applications"
hdiutil create -volname "Passwords Plus" -srcfolder "$staging" -fs HFS+ -format UDZO "$dmg"
rm -rf "$staging"
if [ -n "$identity" ]; then
    codesign --sign "$identity" --timestamp "$dmg"
    notarize "$dmg"
    staple "$dmg"
    spctl --assess --type open --context context:primary-signature --verbose "$dmg"
fi

# the appcast, one item, for an app whose Info.plist has an SUFeedURL pointing at it
if [ -n "${SPARKLE_PRIVATE_KEY:-}" ]; then
    printf '%s' "$SPARKLE_PRIVATE_KEY" | .build/artifacts/sparkle/Sparkle/bin/generate_appcast \
        --ed-key-file - \
        --download-url-prefix "$repo/releases/download/companion-v$version/" \
        --full-release-notes-url "$repo/releases/tag/companion-v$version" \
        --link "$repo" \
        "$updates"
    test -f "$updates/appcast.xml"
fi

echo "released $dmg"
