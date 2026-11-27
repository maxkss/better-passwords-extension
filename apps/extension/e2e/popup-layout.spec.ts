import { expect, PAIRING_CODE, test } from "./fixtures.ts";

// the companion's rows have the longest lines, which once widened the popup's column past its edge
test.use({ companion: "ok" });

test("the popup's lists stay inside its width, with even margins", async ({ context, popupUrl }) => {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 600 });
  await popup.goto(popupUrl);
  const code = popup.getByLabel("Verification code");
  if (await code.isVisible().catch(() => false)) await code.fill(PAIRING_CODE);
  await popup.getByRole("button", { name: "Settings" }).click();
  await expect(popup.getByText("Open it to change what it can do")).toBeVisible();

  const layout = await popup.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    margins: [...document.querySelectorAll(".list")].map((list) => {
      const box = list.getBoundingClientRect();
      return [Math.round(box.left), Math.round(window.innerWidth - box.right)];
    }),
  }));
  expect(layout.overflow).toBe(0);
  for (const [left, right] of layout.margins) expect(left).toBe(right);
});
