import type { Frame, Page } from "@playwright/test";
import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

/** A suggested password: hidden but for its start, shown while the eye is hovered. */
async function revealed(menu: Frame, index: number): Promise<string> {
  const detail = menu.locator(".password").nth(index);
  expect(await detail.textContent()).toMatch(/^.{3}[•-]+$/);
  // the menu resizes as it renders; hover once it has settled, as a person would
  await menu.page().waitForTimeout(500);
  await menu.locator(".reveal").nth(index).hover();
  await expect(detail).not.toContainText("•");
  return (await detail.textContent()) ?? "";
}

// These tests are about passwords: keep the email field's hints (Hide My Email, the companion app)
// out of the way, as a user who dismissed them would.
test.beforeEach(async ({ context, popupUrl }) => {
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.evaluate(() => {
    type Runtime = { runtime: { sendMessage(message: unknown): Promise<unknown> } };
    const { chrome } = globalThis as unknown as { chrome: Runtime };
    return chrome.runtime.sendMessage({
      type: "set-settings",
      settings: { hideMyEmailHint: false, companionEmailsHint: false },
    });
  });
  await popup.close();
});

/** Opens the menu on the new password field and unlocks it. */
async function unlockedMenu(page: Page): Promise<Frame> {
  await page.locator("#new").click();
  const menu = await menuFrame(page);
  // still unlocked from earlier in the test: nothing to do
  if (await menu.getByText("Unlock to suggest a strong password").isVisible()) {
    await choose(menu, "Unlock to suggest a strong password");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  }
  return menu;
}

/** Unlocks, picks the strong password and returns it. */
async function fillStrongPassword(page: Page): Promise<string> {
  const menu = await unlockedMenu(page);
  const password = await revealed(menu, 0);
  await choose(menu, "Strong Password");
  await expect(page.locator("#new")).toHaveValue(password);
  return password;
}

/** Nothing gets saved, given time for a save to happen. */
async function expectNoSave(page: Page, helperSaves: () => unknown[]) {
  await page.waitForTimeout(2_000);
  expect(helperSaves()).toEqual([]);
}

const create = (page: Page) => page.getByRole("button", { name: "Create account" }).click();

test("fills a strong password at once and saves it once the sign-up goes through", async ({
  context,
  siteUrl,
  helperSaves,
}) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/signup.html?mode=spa`);
  await page.locator("#email").fill("new-user@example.com");
  const password = await fillStrongPassword(page);

  // like Safari: filled right away, nothing saved yet
  await expect(page.locator("#confirm")).toHaveValue(password);
  expect(helperSaves()).toEqual([]);
  await page.locator("#email").click();
  await page.locator("#confirm").click();
  await expect((await menuFrame(page)).getByText("You'll be asked to save it when you continue")).toBeVisible();

  // the site moves on (here: the URL changes): saved with the form's username
  await page.locator("#email").fill("renamed@example.com");
  await create(page);
  await expect.poll(helperSaves).toEqual([{ hostname: "localhost", username: "renamed@example.com", password }]);
  await expect
    .poll(async () => {
      await page.locator("#email").click();
      await page.locator("#new").click();
      return (await menuFrame(page)).getByText("Strong Password Saved").isVisible();
    })
    .toBe(true);
});

test("never offers new passwords on a login form", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/login.html`);
  await page.locator("#pass").click();
  const menu = await menuFrame(page);
  await expect(menu.getByText("Unlock to fill passwords")).toBeVisible();
});

test("an extension page inside a tab can't list or save the popup's recent passwords", async ({
  context,
  siteUrl,
  popupUrl,
  helperSaves,
}) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/signup.html`);
  await page.locator("#email").fill("recent@example.com");
  await fillStrongPassword(page);
  // like the inline menu, a page in a tab is bound to its own tab: the list is the popup's alone
  const inTab = await context.newPage();
  await inTab.goto(popupUrl);
  const replies = await inTab.evaluate(async () => {
    const { chrome } = globalThis as unknown as {
      chrome: {
        runtime: { sendMessage(m: unknown): Promise<{ ok: boolean; error?: string }> };
        tabs: { query(q: unknown): Promise<{ id: number }[]> };
      };
    };
    const [site] = await chrome.tabs.query({ url: "http://localhost/*" });
    return Promise.all([
      chrome.runtime.sendMessage({ type: "unconfirmed-passwords", tabId: site?.id }),
      chrome.runtime.sendMessage({ type: "save-unconfirmed-password", tabId: site?.id, id: "x" }),
    ]);
  });
  expect(replies).toMatchObject([
    { ok: false, error: "not allowed" },
    { ok: false, error: "not allowed" },
  ]);
  await expectNoSave(page, helperSaves);
});

test("suggests a passphrase too when asked to, and fills it", async ({ context, siteUrl, popupUrl }) => {
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.evaluate(() => {
    type Runtime = { runtime: { sendMessage(message: unknown): Promise<unknown> } };
    const { chrome } = globalThis as unknown as { chrome: Runtime };
    return chrome.runtime.sendMessage({ type: "set-settings", settings: { passphrases: true } });
  });
  await popup.close();

  const page = await context.newPage();
  await page.goto(`${siteUrl}/signup.html`);
  const menu = await unlockedMenu(page);
  await expect(menu.getByText("Passphrase", { exact: true })).toBeVisible();
  // strong, without special characters, then the passphrase
  const phrase = await revealed(menu, 2);
  expect(phrase).toMatch(/^([A-Za-z]+[0-9]?-){4,}[A-Za-z]+[0-9]?$/);
  await choose(menu, "Passphrase");
  await expect(page.locator("#new")).toHaveValue(phrase);
  await expect(page.locator("#confirm")).toHaveValue(phrase);
});

test("makes passphrases as set in the popup", async ({ context, siteUrl, popupUrl }) => {
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.getByLabel("Verification code").fill(PAIRING_CODE);
  await popup.getByRole("button", { name: "Settings" }).click();
  // the passphrase's settings show once passphrases are on
  await expect(popup.getByRole("combobox", { name: "Words", exact: true })).toHaveCount(0);
  await popup.getByRole("switch", { name: /Passphrases too/ }).check();
  await popup.getByRole("combobox", { name: "Words", exact: true }).selectOption("4");
  await popup.getByRole("combobox", { name: "Between words" }).selectOption({ label: "Period" });
  await popup.getByRole("switch", { name: /Capital letter/ }).uncheck();
  await popup.getByRole("switch", { name: /Number/ }).uncheck();
  await expect(popup.getByRole("switch", { name: /Number/ })).not.toBeChecked();
  // kept when the popup opens again
  await popup.reload();
  await popup.getByRole("button", { name: "Settings" }).click();
  await expect(popup.getByRole("combobox", { name: "Words", exact: true })).toHaveValue("4");
  await expect(popup.getByRole("combobox", { name: "Between words" })).toHaveValue(".");
  await popup.close();

  const page = await context.newPage();
  await page.goto(`${siteUrl}/signup.html`);
  const menu = await unlockedMenu(page);
  // four plain words are weaker than usual: hidden whole, and a badge says why
  const phrase = await revealed(menu, 2);
  expect(phrase).toMatch(/^[a-z-]+(\.[a-z-]+){3}$/);
  await expect(menu.getByRole("button", { name: "Why this password is weaker" })).toBeVisible();
  await choose(menu, "Passphrase");
  await expect(page.locator("#new")).toHaveValue(phrase);
});
