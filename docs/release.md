# Releasing

Releases are automatic. [semantic-release](https://semantic-release.gitbook.io) runs on every push to `main` (`.github/workflows/release.yml`) and reads the [Conventional Commits](https://www.conventionalcommits.org) since the last release of each component:

| Component | Commits | Tags |
|---|---|---|
| Extension (with the shared packages) | everything not scoped `(companion)` | `extension-v*` |
| Companion app | `feat(companion): …`, `fix(companion): …` | `companion-v*` |

`scripts/release/component-commits.js` does the split, for both the version bump and the release notes.

| Commit | Release |
|---|---|
| `fix: …` | patch (1.2.3 → 1.2.4) |
| `feat: …` | minor (1.2.3 → 1.3.0) |
| `feat!: …` or a `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `ci:`, `test:`, `refactor:` … | no release |

When an extension release is due, CI:
1. sets the version in the checkout,
2. builds and zips the Chromium and Firefox packages, plus reviewer source,
3. creates the `extension-vX.Y.Z` tag and a GitHub release with notes and the zips,
4. attests build provenance for the zips (`gh attestation verify <zip> -R maxkss/better-passwords-extension`).

This fork doesn't submit to the browser stores.

The Chromium extension ID is `dldapmofalpjbidlgmmjkiikhhckemlo`. Its public key is the manifest `key` in `apps/extension/src/config.ts`, so every unpacked install gets this ID; the setup script and companion allow it. Chrome rejects that field on store upload, so `.output/store/` has a copy without it. If the identity ever changes, update the extension config, setup script, companion identity and tests together.

## Companion app

The companion job stays off until the repository variable `COMPANION_RELEASE` is `true`. An unsigned app would be blocked by Gatekeeper, so a release needs these secrets:

| Secret | What |
|---|---|
| `MACOS_CERTIFICATE` | Developer ID Application certificate with its private key, as a base64 `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password of that `.p12` |
| `MACOS_SIGN_IDENTITY` | e.g. `Developer ID Application: Name (TEAMID)` |
| `NOTARY_KEY` | App Store Connect API key (`.p8`), base64 |
| `NOTARY_KEY_ID`, `NOTARY_ISSUER` | That key's ID and issuer |
| `SPARKLE_PRIVATE_KEY` | Sparkle's EdDSA private key, as `generate_keys --account passwords-plus -x <file>` exports it. Its public half is `SUPublicEDKey` in `apps/companion/Resources/Info.plist` |

`apps/companion/scripts/release.sh`:

1. builds a universal app, signs it with the hardened runtime, notarizes it and staples the ticket,
2. puts it in a disk image next to a link to Applications, then signs, notarizes and staples the disk image,
3. runs Sparkle's `generate_appcast`, which signs the disk image and the appcast with the EdDSA key.

semantic-release attaches the disk image and `appcast.xml` to a `companion-vX.Y.Z` GitHub release, and CI attests the disk image's build provenance.

This fork's app has no appcast: `SUFeedURL` and `SUPublicEDKey` are left out of `apps/companion/Resources/Info.plist`, so installed apps never look for updates. To ship updates, generate your own Sparkle key, put its public half in `SUPublicEDKey`, and point `SUFeedURL` at an `appcast.xml` you host.

**Keep the Sparkle key.** Installed apps accept only updates and appcasts signed with it. It lives in the maintainer's login keychain under the account `passwords-plus`; back it up outside the keychain too. If it's lost, Sparkle still accepts a disk image signed with the same Developer ID, so a release can ship a new public key. Its appcast won't match the key in installed apps, though, so they only see that release once Sparkle's signed-feed fallback expires (20 days).

Signed builds trust their native host by team ID, so the app and the host must be signed with the same Developer ID.
