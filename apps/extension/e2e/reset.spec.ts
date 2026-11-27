import type { Page } from "@playwright/test";
import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

// A password reset page asks for a new password and nothing else: the menu says whose it is, and
// Apple Passwords is asked to save it for that account (macOS's prompt has the final say).

/** Opens the menu on the reset page's new password field, unlocking if needed. */
async function resetMenu(page: Page, siteUrl: string) {
  await page.goto(`${siteUrl}/reset.html`);
  await page.locator("#new").click();
  const menu = await menuFrame(page);
  if (await menu.getByText("Unlock to suggest a strong password").isVisible()) {
    await choose(menu, "Unlock to suggest a strong password");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  }
  await expect(menu.getByText("Strong Password")).toBeVisible();
  return menu;
}

async function resetWithStrongPassword(page: Page, menu: Awaited<ReturnType<typeof resetMenu>>) {
  await choose(menu, "Strong Password");
  await expect(page.locator("#new")).not.toHaveValue("");
  await page.locator("#save").click();
}

test("saves for the site's only account", async ({ context, siteUrl, helperSaves }) => {
  const page = await context.newPage();
  const menu = await resetMenu(page, siteUrl);
  await expect(menu.getByText("For e2e-user")).toBeVisible();
  await resetWithStrongPassword(page, menu);
  await expect.poll(() => helperSaves().map((save) => save.username)).toEqual(["e2e-user"]);
});
