import { expect, PAIRING_CODE, test } from "./fixtures.ts";

// A browser the setup script hasn't run for yet. The extension welcomes the user, says what to
// do, and notices by itself once it's done (`runSetup` registers the helper, as the script does).

test.use({ setUp: false });

test("the popup welcomes, notices the setup, and moves on to the code", async ({ context, popupUrl, runSetup }) => {
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await expect(popup.getByRole("heading", { name: "Welcome to Passwords Plus" })).toBeVisible();
  // "not set up" is the normal first state, not an error
  await expect(popup.getByText(/native messaging host/i)).toHaveCount(0);

  // one route at a time: the Terminal one replaces the app's
  await popup.getByRole("button", { name: "Rather not install an app?" }).click();
  await expect(popup.getByRole("link", { name: "Download the Mac App" })).toHaveCount(0);
  await expect(popup.getByText("Waiting for the connection…")).toBeHidden();
  await popup.getByRole("button", { name: "Copy Terminal Command" }).click();
  await expect(popup.getByText("Waiting for the connection…")).toBeVisible();

  runSetup();
  await expect(popup.getByRole("heading", { name: "You're connected" })).toBeVisible();
  await popup.getByRole("button", { name: "Continue" }).click();
  await popup.getByLabel("Verification code").fill(PAIRING_CODE);
  await expect(popup.getByText("You're all set.")).toBeVisible();
});
