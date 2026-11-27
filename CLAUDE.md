# Passwords Plus

A browser extension that fills from Apple Passwords (`apps/extension`), the helper protocol (`packages/protocol`), a fake helper for tests (`packages/fake-helper`) and an optional Mac companion app (`apps/companion`). [CONTRIBUTING.md](CONTRIBUTING.md) has setup and commands; [docs/](docs/) has the architecture and threat model.

## Running tests

Run what the change touches, not everything.

- **Unit tests** (Vitest, happy-dom) are the default check. Run only the files for what changed: `bunx vitest run apps/extension/test/<file>.test.ts`.
- **E2E tests** (Playwright, real Chromium with the fake helper) take minutes. Run only the spec, or the one test, that covers the change: `bun run --filter @app/extension build:chrome`, then `bunx playwright test e2e/<file>.spec.ts -g '<test name>'` in `apps/extension`.
- **Wording, styles, icons or docs only:** typecheck and lint. No e2e.
- **Several edits in a row:** collect them and run the tests once at the end, not after each edit.

Run the whole e2e suite only:

- right before a commit or PR that changes code shared across the extension: the content script, the background, filling, field detection, the protocol;
- or when the user asks.

Always say in the report what ran and what didn't.

## Adding tests

The e2e suite is kept small on purpose (about 30 tests: one per user-facing flow, plus the security boundaries only a real browser shows). Keep it that way.

- **Put a case in the narrowest layer that can show it.** Field detection, generating, parsing and filling logic go in unit tests. Prefer a new row in an existing `it.each` table over a new test.
- **Add an e2e test only when a unit test can't show the behavior** and no existing e2e test already walks that flow. That means real layout or visibility, shadow roots, frames, native messaging, extension pages, or a security boundary.
- **At most one new e2e test per feature or fix.** Its edge cases go in unit tests.
- **Don't add a test for every variation you think of.** One test that fails without the change is enough.
- **Replace instead of piling up.** If a new e2e test covers what an old one did, remove the old one in the same change.
