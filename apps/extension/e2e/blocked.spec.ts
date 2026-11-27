import { expect, test } from "./fixtures.ts";

// A browser macOS doesn't let start Apple's helper (its launch constraints): set up, but the helper
// dies before answering. The extension must say so plainly, never "connected", and must not keep
// launching the helper: on a real Mac each launch leaves a crash report. Each attempt launches it
// twice: a helper that quits once may just have crashed.

test.use({ setUp: false });

test("says the browser is blocked instead of connected", async ({ context, popupUrl, runBlockedSetup }) => {
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await expect(popup.getByRole("heading", { name: "Welcome to Passwords Plus" })).toBeVisible();

  runBlockedSetup();
  await expect(popup.getByRole("heading", { name: /can't use Apple Passwords yet/ })).toBeVisible();
  await expect(popup.getByRole("heading", { name: "You're connected" })).toHaveCount(0);
  // the raw error is there for a bug report, but folded away
  const details = popup.locator("details", { hasText: "Native host has exited." });
  await expect(details).toHaveJSProperty("open", false);
});
