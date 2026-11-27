import { describe, expect, it } from "vitest";
import { REPO_URL } from "../src/config.ts";
import { reportLinks } from "../src/ui/report.ts";

const details = { version: "1.3.1", browser: "Google Chrome 141.0.7390.54", os: "macOS 26.1.0" };

describe("reportLinks", () => {
  it("opens the bug form with the details filled in", () => {
    const url = new URL(reportLinks(details).github);
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ template: "bug.yml", ...details });
  });

  it("leaves out details it couldn't read", () => {
    const url = new URL(reportLinks({ version: "1.3.1", browser: "Firefox 145.0" }).github);
    expect(url.searchParams.has("os")).toBe(false);
    expect(new URL(reportLinks({}).github).search).toBe("?template=bug.yml");
  });
});
