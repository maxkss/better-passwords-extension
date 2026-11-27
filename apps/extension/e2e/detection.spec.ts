import type { Page } from "@playwright/test";
import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

// Pages that are easy to misread: fields nobody can see, fields in shadow roots, buttons that
// aren't <button>s, and buttons that sign in with another account (single sign-on).

/** The inline menu opened on the page, within a few seconds. */
async function expectMenu(page: Page) {
  await expect.poll(() => page.locator("app-autofill-menu").count(), { timeout: 5_000 }).toBe(1);
}

/** Unlocks from the menu on the password field, then types a login of the user's own. */
async function typeLogin(page: Page, username: string, password: string) {
  await page.locator("#pass").click();
  const menu = await menuFrame(page);
  await choose(menu, "Unlock to fill passwords");
  await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  await expect(menu.getByText("Manage Passwords…")).toBeVisible();
  await page.locator("#user").fill(username);
  await page.locator("#pass").fill(password);
  await page.locator("#pass").press("Escape");
}

test.describe("hidden fields", () => {
  test("don't make a sign-in look like a sign-up", async ({ context, siteUrl }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/hidden-trap.html`);
    await page.locator("#pass").click();
    const menu = await menuFrame(page);
    await choose(menu, "Unlock to fill passwords");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
    // and the login goes into the fields people see, not the traps
    await choose(menu, "e2e-user");
    await expect(page.locator("#user")).toHaveValue("e2e-user");
    await expect(page.locator("#pass")).toHaveValue("e2e-pass");
    await expect(page.locator("[name=trap-user]")).toHaveValue("");
    await expect(page.locator("[name=trap-pass]")).toHaveValue("");
  });
});

test.describe("a sign-in in a shadow root", () => {
  test("gets the menu when the root is open", async ({ context, siteUrl }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/shadow.html`);
    // Playwright's locators reach into open shadow roots
    await page.locator("#pass").click();
    await expectMenu(page);
    const menu = await menuFrame(page);
    await choose(menu, "Unlock to fill passwords");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
    await choose(menu, "e2e-user");
    await expect(page.locator("#user")).toHaveValue("e2e-user");
    await expect(page.locator("#pass")).toHaveValue("e2e-pass");
  });

  test("gets the menu when the root is closed", async ({ context, siteUrl }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/shadow.html?mode=closed`);
    // locators can't reach into a closed root, so click where the page says the field is
    const box = await page.evaluate(() => {
      const rect = (
        window as unknown as { shadowFields: { pass: HTMLElement } }
      ).shadowFields.pass.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await expectMenu(page);
    const menu = await menuFrame(page);
    await choose(menu, "Unlock to fill passwords");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
    await choose(menu, "e2e-user");
    const values = () =>
      page.evaluate(() => {
        const { user, pass } = (window as unknown as { shadowFields: Record<string, HTMLInputElement> }).shadowFields;
        return [user?.value, pass?.value];
      });
    await expect.poll(values).toEqual(["e2e-user", "e2e-pass"]);
  });
});

test.describe("a sign-in sent by a div", () => {
  test("is saved once the page moves on", async ({ context, siteUrl, helperSaves }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/div-button.html`);
    await typeLogin(page, "div@example.com", "typed-div-pass");
    await page.locator("#go").click();
    await expect(page.getByText("Welcome!")).toBeVisible();
    await expect
      .poll(helperSaves, { timeout: 5_000 })
      .toEqual([{ hostname: "localhost", username: "div@example.com", password: "typed-div-pass" }]);
  });
});

test.describe("SSO buttons", () => {
  test("don't make a sign-up look like a sign-in", async ({ context, siteUrl }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/sso-signup.html`);
    await page.locator("#new").click();
    const menu = await menuFrame(page);
    await expect(menu.getByText("Unlock to suggest a strong password")).toBeVisible();
  });

  test("don't send the password typed so far", async ({ context, siteUrl, helperSaves }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/sso-login.html`);
    await typeLogin(page, "sso@example.com", "never-sent");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByText("Welcome!")).toBeVisible();
    await page.waitForTimeout(2_000);
    expect(helperSaves()).toEqual([]);
  });
});
