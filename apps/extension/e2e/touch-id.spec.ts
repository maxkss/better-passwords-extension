import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

// The Touch ID companion is replaced by a fake native host that answers as the real one does
// after the user confirmed (or cancelled) Touch ID.

test.describe("with the companion app", () => {
  test.use({ companion: "ok" });

  test("the inline menu unlocks with Touch ID and fills", async ({ context, siteUrl }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/login.html`);
    await page.locator("#pass").click();
    const menu = await menuFrame(page);
    await expect(menu.getByText("Touch ID enters the code for you")).toBeVisible();
    await choose(menu, "Unlock to fill passwords");
    await choose(menu, "e2e-user");
    await expect(page.locator("#pass")).toHaveValue("e2e-pass");
  });
});

test.describe("when Touch ID is cancelled", () => {
  test.use({ companion: "cancelled" });

  test("the code can still be typed", async ({ context, popupUrl }) => {
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await expect(popup.getByText("Touch ID was cancelled.")).toBeVisible();
    await expect(popup.getByRole("button", { name: "Enter It With Touch ID" })).toBeVisible();
    await popup.getByLabel("Verification code").fill(PAIRING_CODE);
    await expect(popup.getByText("Open a website to see its saved passwords.")).toBeVisible();
  });
});
