import { choose, expect, menuFrame, PAIRING_CODE, test } from "./fixtures.ts";

test("fills a sign-in inside an iframe of the page's own origin", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/framed-login.html`);
  const form = page.frameLocator("#widget");
  await form.locator("#user").click();

  const menu = await menuFrame(page);
  await choose(menu, "Unlock to fill passwords");
  await menu.getByLabel("Verification code").fill(PAIRING_CODE);
  await choose(menu, "e2e-user");

  await expect(form.locator("#user")).toHaveValue("e2e-user");
  await expect(form.locator("#pass")).toHaveValue("e2e-pass");
});

test("no menu in an iframe of another origin", async ({ context, siteUrl }) => {
  const page = await context.newPage();
  await page.goto(`${siteUrl}/welcome.html`);
  const other = siteUrl.replace("localhost", "127.0.0.1");
  await page.evaluate((src) => {
    const frame = document.createElement("iframe");
    frame.id = "widget";
    frame.src = src;
    document.body.append(frame);
  }, `${other}/framed-login-form.html`);

  const field = page.frameLocator("#widget").locator("#user");
  await field.click();
  await expect(field).toBeFocused();
  await page.waitForTimeout(1_500);
  expect(page.frames().some((f) => f.url().includes("/menu.html#"))).toBe(false);
});
