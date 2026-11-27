import type { Page } from "@playwright/test";
import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

/** Unlocks from the menu on the password field, then types a login of the user's own. */
async function typeLogin(page: Page, username: string, password: string, unlock = true) {
  await page.locator("#pass").click();
  if (unlock) {
    const menu = await menuFrame(page);
    await choose(menu, "Unlock to fill passwords");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
    await expect(menu.getByText("Manage Passwords…")).toBeVisible();
  }
  await page.locator("#user").fill(username);
  await page.locator("#pass").fill(password);
  // the menu of saved logins would cover the Sign in button; done with it, as a person would be
  await page.locator("#pass").press("Escape");
}

const signIn = (page: Page) => page.getByRole("button", { name: "Sign in" }).click();

/** Nothing saved, given time for a save. */
async function expectNoSave(page: Page, helperSaves: () => unknown[]) {
  await page.waitForTimeout(2_000);
  expect(helperSaves()).toEqual([]);
}

test("saves a new login once the sign-in goes through", async ({ context, siteUrl, helperSaves }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/signin.html`);
  await typeLogin(page, "new@example.com", "typed-pass-1");
  await signIn(page);
  await expect(page.getByText("Welcome!")).toBeVisible();
  await expect
    .poll(helperSaves)
    .toEqual([{ hostname: "localhost", username: "new@example.com", password: "typed-pass-1" }]);
});

test.describe("doesn't save it", () => {
  test("when the site rejects the password", async ({ context, siteUrl, helperSaves }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/signin.html?mode=error`);
    await typeLogin(page, "wrong@example.com", "not-it");
    await signIn(page);
    await expect(page.getByRole("alert")).toHaveText("Wrong password.");
    await expectNoSave(page, helperSaves);
  });
});
