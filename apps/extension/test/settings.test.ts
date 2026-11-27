import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultSettings, type Settings, withStoredSettings } from "../src/messages.ts";

describe("defaultSettings", () => {
  it("locks with the PC on Windows, where Apple's helper never asks before filling", () => {
    expect(defaultSettings("windows")).toEqual({ ...DEFAULT_SETTINGS, lockOnScreenLock: true });
  });

  it("leaves the Mac defaults as they are", () => {
    expect(defaultSettings("mac")).toEqual(DEFAULT_SETTINGS);
    expect(defaultSettings("mac").lockOnScreenLock).toBe(false);
  });
});

describe("withStoredSettings", () => {
  it.each<[string, Record<string, unknown> | undefined, Settings["passwordStyle"]]>([
    ["nothing saved", undefined, "apple"],
    ["the style chosen", { passwordStyle: "passphrase" }, "passphrase"],
    // the earlier switch that added a passphrase to the suggestions
    ["the old passphrase switch on", { passphrases: true }, "passphrase"],
    ["the old passphrase switch off", { passphrases: false }, "apple"],
    ["a style chosen since, over the old switch", { passphrases: true, passwordStyle: "apple" }, "apple"],
  ])("reads %s", (_, stored, style) => {
    const settings = withStoredSettings(DEFAULT_SETTINGS, stored);
    expect(settings.passwordStyle).toBe(style);
    expect(settings).not.toHaveProperty("passphrases");
  });
});
