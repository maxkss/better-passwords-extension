// A way to report a problem from inside the extension: GitHub's bug form, pre-filled with versions
// only. Nothing is sent until the user submits it.

import { REPO_URL } from "../config.ts";
import { h } from "./h.ts";

/** What a bug report needs and people often leave out. Each is optional: it may not be readable. */
export interface ReportDetails {
  version?: string;
  browser?: string;
  /** The operating system and its version, as in "macOS 26.1.0" or "Windows 11". */
  os?: string;
}

/** The pre-filled bug form. The query keys are the field ids in .github/ISSUE_TEMPLATE/bug.yml. */
export function reportLinks(details: ReportDetails): { github: string } {
  const form = new URLSearchParams({ template: "bug.yml" });
  for (const [key, value] of Object.entries(details)) if (value) form.set(key, value);

  return { github: `${REPO_URL}/issues/new?${form}` };
}

/** Chromium's User-Agent Client Hints; the user-agent string itself always says macOS 10.15.7. */
interface UADataValues {
  platform?: string;
  platformVersion?: string;
  fullVersionList?: { brand: string; version: string }[];
}
type UAData = { getHighEntropyValues(hints: string[]): Promise<UADataValues> };

/** Reads the details this browser exposes; whatever it can't read is left out. */
export async function reportDetails(): Promise<ReportDetails> {
  const details: ReportDetails = {};
  try {
    details.version = browser.runtime.getManifest().version;
  } catch {
    // left for the user to fill in
  }
  if (import.meta.env.FIREFOX) {
    try {
      const runtime = browser.runtime as unknown as { getBrowserInfo(): Promise<{ name: string; version: string }> };
      const { name, version } = await runtime.getBrowserInfo();
      details.browser = `${name} ${version}`;
    } catch {
      // left for the user to fill in
    }
    return details;
  }
  try {
    const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
    const values = await uaData?.getHighEntropyValues(["fullVersionList", "platformVersion"]);
    // the browser's own brand, not Chromium or the made-up "Not A Brand" entries
    const brands = values?.fullVersionList ?? [];
    const brand =
      brands.find((b) => !/not.a.brand|^chromium$/i.test(b.brand)) ?? brands.find((b) => b.brand === "Chromium");
    if (brand) details.browser = `${brand.brand} ${brand.version}`;
    if (values?.platform === "macOS" && values.platformVersion) details.os = `macOS ${values.platformVersion}`;
    // Windows reports 13 and up for Windows 11, and 1 to 10 for Windows 10
    if (values?.platform === "Windows" && values.platformVersion) {
      details.os = Number.parseInt(values.platformVersion, 10) >= 13 ? "Windows 11" : "Windows 10";
    }
  } catch {
    // left for the user to fill in
  }
  return details;
}

/** This browser's own name ("Ardia", "Google Chrome"), without its version; undefined if it doesn't say. */
export async function browserName(): Promise<string | undefined> {
  const browser = (await reportDetails()).browser;
  return browser?.replace(/\s+[\d.]+$/, "") || undefined;
}

/** "Something wrong? Report it on GitHub." */
export function reportProblem(): HTMLElement {
  const plain = reportLinks({});
  const github = h("a", { href: plain.github, target: "_blank", rel: "noopener", textContent: "Report it on GitHub" });
  // the link works right away; it gains the details as soon as those are read
  void reportDetails().then((details) => {
    github.href = reportLinks(details).github;
  });
  return h("p", { class: "report" }, "Something wrong? ", github, ".");
}
