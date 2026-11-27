import { EXTENSION_ID } from "../src/config.ts";
import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

test("unlocks from the inline menu and fills the form", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/login.html`);
  await page.locator("#pass").click();

  // locked: the menu offers to unlock, and the code is typed inside the extension's own frame
  const menu = await menuFrame(page);
  await choose(menu, "Unlock to fill passwords");
  // the code box and "Show code again" fit: nothing to scroll
  await expect(menu.getByText("Show code again")).toBeVisible();
  await page.waitForTimeout(300);
  expect(
    await menu.evaluate(() => {
      const panel = document.getElementById("menu") as HTMLElement;
      return panel.scrollHeight - panel.clientHeight;
    }),
  ).toBeLessThanOrEqual(0);
  await menu.getByLabel("Verification code").fill(PAIRING_CODE);

  await choose(menu, "e2e-user");
  await expect(page.locator("#user")).toHaveValue("e2e-user");
  await expect(page.locator("#pass")).toHaveValue("e2e-pass");
  await expect(page.locator("#newsletter-email")).toHaveValue("");
  // filled and done: no field is left focused
  await expect(page.locator("#pass")).not.toBeFocused();
  await expect(page.locator("#user")).not.toBeFocused();
});

test("refuses to fill when the page makes the menu transparent", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/login.html`);
  await page.locator("#pass").click();
  const menu = await menuFrame(page);
  await choose(menu, "Unlock to fill passwords");
  await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  await expect(menu.getByText("e2e-user")).toBeVisible();

  // a clickjacking page fades everything out, hoping the user clicks blindly
  await page.evaluate(() => {
    document.documentElement.style.opacity = "0.1";
  });
  await menu.getByText("e2e-user").click({ force: true });
  await page.waitForTimeout(500);
  await expect(page.locator("#pass")).toHaveValue("");
});

test("a page can't frame the menu at its well-known address", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/login.html`);
  // Chromium serves menu.html only at a per-session address, which pages never learn
  await page.evaluate((url) => {
    const frame = document.createElement("iframe");
    frame.src = `${url}#nonce=forged&mode=logins`;
    frame.id = "forged";
    document.body.append(frame);
  }, `chrome-extension://${EXTENSION_ID}/menu.html`);
  await page.waitForTimeout(1_000);
  await expect(page.frameLocator("#forged").locator("#menu")).toHaveCount(0);
});

test("refuses everything a copy of the menu without our nonce asks", async ({ context, siteUrl, popupUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/login.html`);
  // unlock through the real menu first, so a fill would otherwise succeed
  await page.locator("#pass").click();
  const menu = await menuFrame(page);
  await choose(menu, "Unlock to fill passwords");
  await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  await expect(menu.getByText("e2e-user")).toBeVisible();

  // a copy of menu.html with a made-up nonce, as a page that found its address could frame it
  // (Firefox has no per-session address): it lists nothing
  const forged = await context.newPage();
  await forged.goto(`chrome-extension://${EXTENSION_ID}/menu.html#nonce=forged&mode=logins`);
  await expect(forged.getByText("wasn't opened by Passwords Plus")).toBeVisible();
  await expect(forged.getByText("e2e-user")).toHaveCount(0);

  // Nor does anything it asks get through, as an accepted click would ask it: no password is
  // fetched, and no setting changes (turning on Hide My Email would reserve addresses later).
  const replies = await forged.evaluate(async () => {
    type Runtime = { runtime: { sendMessage(message: unknown): Promise<unknown> } };
    const { chrome } = globalThis as unknown as { chrome: Runtime };
    const ask = (message: object) => chrome.runtime.sendMessage({ ...message, menuNonce: "forged" });
    return [
      await ask({ type: "fill-from-menu", nonce: "forged", username: "e2e-user" }),
      await ask({ type: "enable-hide-my-email", nonce: "forged" }),
      await ask({ type: "list-logins" }),
    ];
  });
  for (const reply of replies) {
    expect(reply).toEqual({ ok: false, error: "This menu wasn't opened by Passwords Plus." });
  }
  await expect(page.locator("#pass")).toHaveValue("");

  const popup = await context.newPage();
  await popup.goto(popupUrl);
  const settings = await popup.evaluate(() => {
    type Runtime = { runtime: { sendMessage(message: unknown): Promise<{ value: { hideMyEmail: boolean } }> } };
    const { chrome } = globalThis as unknown as { chrome: Runtime };
    return chrome.runtime.sendMessage({ type: "get-settings" });
  });
  expect(settings.value.hideMyEmail).toBe(false);
});

test.describe("a sign-in in two steps", () => {
  test.use({
    vaultEntries: [
      [
        { hostname: "localhost", username: "alice@example.com", password: "alice-pass" },
        { hostname: "localhost", username: "bob@example.com", password: "bob-pass" },
      ],
      { scope: "test" },
    ],
  });

  test("fills the email without reading the password, then offers just that login for the password", async ({
    context,
    siteUrl,
    passwordReads,
  }) => {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/two-step.html`);
    await page.locator("#email").click();
    let menu = await menuFrame(page);
    await choose(menu, "Unlock to fill passwords");
    await menu.getByLabel("Verification code").fill(PAIRING_CODE);
    await choose(menu, "bob@example.com");
    await expect(page.locator("#email")).toHaveValue("bob@example.com");
    // no password field yet: no password read, so no Touch ID
    expect(passwordReads()).toBe(0);

    // back in the email field, every account is offered (the user may want another one)
    await page.locator("#email").click();
    menu = await menuFrame(page);
    await expect(menu.getByText("alice@example.com")).toBeVisible();
    await expect(menu.getByText("bob@example.com")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.locator("#next").click();
    await page.locator("#password").click();
    menu = await menuFrame(page);
    await expect(menu.getByText("bob@example.com")).toBeVisible();
    await expect(menu.getByText("alice@example.com")).toHaveCount(0);
    // the others are a click away
    await choose(menu, "1 other account");
    await expect(menu.getByText("alice@example.com")).toBeVisible();
    await choose(menu, "bob@example.com");
    await expect(page.locator("#password")).toHaveValue("bob-pass");
    expect(passwordReads()).toBe(1);
  });
});
