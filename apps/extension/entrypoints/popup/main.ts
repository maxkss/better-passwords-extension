import "./style.css";
import { DISPLAY_NAME } from "@/src/config.ts";
import { requestHideMyEmailConsent } from "@/src/icloud/consent.ts";
import { type LoginsResult, type OneTimeCodesResult, type Settings, type Status, send } from "@/src/messages.ts";
import { computerName, platform } from "@/src/platform.ts";
import { applySystemAccent } from "@/src/ui/accent.ts";
import { bindCodeInput } from "@/src/ui/code-input.ts";
import { companionPitch } from "@/src/ui/companion-pitch.ts";
import { h } from "@/src/ui/h.ts";
import { BACK, CHECK, GEAR, icon, LOCK, TIMER, WARNING } from "@/src/ui/icons.ts";
import { reportProblem } from "@/src/ui/report.ts";
import { setupFlow } from "@/src/ui/setup.ts";

applySystemAccent();

const app = document.getElementById("app") as HTMLElement;
/** "Mac" or "PC": the computer showing Apple's code (set before the first screen). */
let computer = "Mac";
/** What's shown while a verification code is fetched: macOS asks for Touch ID, Windows nothing. */
let fetchingCode = "Confirm with Touch ID…";

type Child = Node | false | null | undefined;

function show(...children: Child[]) {
  app.replaceChildren(...children.filter((c): c is Node => Boolean(c)));
}

function errorLine(message: string | undefined) {
  return message ? h("p", { class: "foot error", textContent: message }) : null;
}

// --- building blocks, as Apple's iOS and iPadOS kit draws them ------------------------------------

/** A round toolbar button: a symbol, or a short text. */
function tool(label: string, glyph: string | { text: string }, onClick: () => void): HTMLButtonElement {
  const button = h(
    "button",
    { class: typeof glyph === "string" ? "tool" : "tool text", type: "button", title: label },
    typeof glyph === "string" ? icon(glyph) : glyph.text,
  );
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

/** The toolbar: a button each side, the title centred between them. */
function toolbar(title: string, leading: Node | null, trailing: Node | null) {
  return h(
    "header",
    { class: "toolbar" },
    leading ?? h("span"),
    h("h1", { textContent: title }),
    trailing ?? h("span"),
  );
}

function sectionTitle(text: string) {
  return h("h2", { class: "hdr", textContent: text });
}

interface RowOptions {
  /** A button for a row that is itself the action, a label for a switch, else a plain row. */
  as?: "button" | "label" | "div";
  tall?: boolean;
  lead?: Node | null;
  title: string | Node;
  subtitle?: string;
  trailing?: Node | null;
  className?: string;
}

/** A list row: an optional image, a title (and subtitle) and an optional trailing control. */
function row({ as = "div", tall, lead, title, subtitle, trailing, className }: RowOptions): HTMLElement {
  const text = h(
    "span",
    { class: "text" },
    typeof title === "string" ? h("span", { class: "title", textContent: title }) : title,
    subtitle ? h("span", { class: "subtitle", textContent: subtitle }) : null,
  );
  const classes = ["row", tall ? "tall" : "", className ?? ""].filter(Boolean).join(" ");
  const el = h(as, { class: classes }, lead ?? null, h("span", { class: "body" }, text, trailing ?? null));
  if (el instanceof HTMLButtonElement) el.type = "button";
  return el;
}

function tile(content: string | SVGSVGElement, accent = false) {
  return h("span", { class: accent ? "tile accent" : "tile", attrs: { "aria-hidden": "true" } }, content);
}

function linkButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = h("button", { class: "link", type: "button", textContent: text });
  button.addEventListener("click", onClick);
  return button;
}

function list(...rows: Child[]) {
  return h("div", { class: "list" }, ...rows.filter((r): r is Node => Boolean(r)));
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// --- the flow ------------------------------------------------------------------------------------

async function refresh(error?: string) {
  let status: Status;
  try {
    status = await within(send({ type: "get-status" }));
  } catch (e) {
    return showRetry(messageOf(e));
  }

  // not set up yet, set up moments ago (the popup closes while the user does it), or set up in a
  // browser macOS doesn't let start Apple's helper (the setup flow explains)
  if (status.state === "no-helper" || status.state === "blocked" || status.justConnected) return showSetup(status);

  if (status.state === "unlocked") return showLogins(status, error);
  // locked or disconnected: start unlocking right away, saving the user a click
  const awaitingCode = status.state === "awaiting-code";
  if (status.touchId && !error && !awaitingCode) return unlockWithTouchId(status);
  // a fresh code even if one is still valid: the user may have closed Apple's window since, and
  // nothing tells us
  codeRequest = popupSettled().then(() => send({ type: "request-code", fresh: true }));
  const input = showCodeEntry(status, error ?? (awaitingCode ? status.error : undefined));
  try {
    await codeRequest;
  } catch (e) {
    return showRetry(error ?? messageOf(e));
  }
  // Apple's code window can take the keyboard as it opens (on Windows it opens slowly, and only
  // then does the helper answer), so give it back to the box, unless the user is typing already
  if (input.isConnected && !input.disabled && input.value === "") {
    window.focus();
    input.focus();
  }
}

/** The pending request for a code; a code typed meanwhile is checked once it's done. */
let codeRequest: Promise<unknown> = Promise.resolve();

/**
 * Resolves once the popup has the keyboard and a moment has passed. Asked while the popup is
 * still opening, Apple's code window takes the keyboard from it; asked afterwards, it doesn't.
 * Never waits more than a second.
 */
function popupSettled(): Promise<void> {
  return new Promise((resolve) => {
    const done = setTimeout(resolve, 1_000);
    const settle = () => {
      clearTimeout(done);
      setTimeout(resolve, 300);
    };
    if (document.hasFocus()) settle();
    else window.addEventListener("focus", settle, { once: true });
  });
}

/** A screen with one message: a symbol in a circle, a title, a line under it, then the rest. */
function prompt(symbol: string, title: string, lead: string, ...rest: Child[]) {
  return h(
    "section",
    { class: "prompt" },
    h("div", { class: "symbol" }, icon(symbol)),
    h("h1", { textContent: title }),
    h("p", { textContent: lead }),
    ...rest.filter((c): c is Node => Boolean(c)),
  );
}

async function unlockWithTouchId(status: Status) {
  show(h("main", {}, prompt(LOCK, "Confirm with Touch ID", "The code your Mac shows is entered for you.")));
  try {
    await send({ type: "unlock-with-touch-id" });
    await refresh();
  } catch (e) {
    // the code is on screen either way, so typing it still works
    showCodeEntry(status, messageOf(e));
  }
}

/** Set once this popup has shown the setup flow, so the first unlock after it says "all set". */
let settingUp = false;

async function showSetup(status: Status) {
  settingUp = true;
  show(
    h(
      "main",
      { class: "setup-main" },
      await setupFlow(status, { next: { label: "Continue", run: () => void refresh() } }),
    ),
  );
}

function showRetry(error: string) {
  const retry = h("button", { class: "capsule", type: "button", textContent: "Try again" });
  retry.addEventListener("click", () => void refresh());
  show(h("main", {}, prompt(WARNING, DISPLAY_NAME, error, h("div", { class: "actions" }, retry)), reportProblem()));
}

/** Shows the box for the code and returns it. */
function showCodeEntry(status: Status, error?: string): HTMLInputElement {
  const input = h("input", {
    class: "code",
    inputMode: "numeric",
    autocomplete: "one-time-code",
    ariaLabel: "Verification code",
    placeholder: "000000",
    autofocus: true,
  });
  const newCode = linkButton("Show code again", async () => {
    await send({ type: "request-code", fresh: true }).catch((e) => showCodeEntry(status, messageOf(e)));
    input.value = "";
    input.focus();
  });

  const submit = async (code: string) => {
    input.disabled = true;
    try {
      await codeRequest.catch(() => {});
      await send({ type: "verify-code", code });
      await refresh();
    } catch (e) {
      // a wrong code burns the challenge, so ask the Mac for a fresh one
      await send({ type: "request-code", fresh: true }).catch(() => {});
      showCodeEntry(status, messageOf(e));
    }
  };
  bindCodeInput(input, (code) => void submit(code));

  let touchId: HTMLButtonElement | null = null;
  if (status.touchId) {
    touchId = h("button", { class: "capsule", type: "button", textContent: "Enter It With Touch ID" });
    touchId.addEventListener("click", () => void unlockWithTouchId(status));
  }
  const companionHint =
    status.companion === "needs-setup"
      ? h("p", { class: "foot" }, "To skip typing the code, finish setting up the companion app.")
      : null;
  const report = reportProblem();

  show(
    h(
      "main",
      {},
      prompt(
        LOCK,
        `Enter the code shown on your ${computer}`,
        `Your ${computer} is showing a 6-digit code. You only do this once per browser session.`,
        input,
        error ? h("p", { class: "error", textContent: error }) : null,
        h("div", { class: "actions" }, newCode, touchId),
        companionHint,
      ),
      report,
    ),
  );
  void companionPitch(() => {
    void send({ type: "open-companion-page" }).catch(() => {});
    window.close();
  }).then((pitch) => {
    if (pitch && input.isConnected) report.before(pitch);
  });
  // Apple's code window can take focus as it appears; take it back when the popup regains it
  const refocus = () => {
    if (input.isConnected && !input.disabled) input.focus();
    else window.removeEventListener("focus", refocus);
  };
  window.addEventListener("focus", refocus);
  requestAnimationFrame(refocus);
  return input;
}

// --- unlocked: the site's passwords and codes ----------------------------------------------------

/** How long the popup waits for an answer before it shows its frame, and before it gives up. */
const LOADING_AFTER_MS = 150;
const ANSWER_WITHIN_MS = 10_000;

/** `request`, or an error once `ms` have passed without an answer. */
function within<T>(request: Promise<T>, ms = ANSWER_WITHIN_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Apple Passwords didn't answer. Close the popup and try again.")), ms);
  });
  return Promise.race([request, late]).finally(() => clearTimeout(timer));
}

async function showLogins(status: Status, error?: string) {
  const lock = tool("Lock", LOCK, async () => {
    await send({ type: "lock" });
    window.close();
  });
  const settings = tool("Settings", GEAR, () => void showSettings(status));

  // the frame, if the answers take a moment, so the popup is never blank meanwhile
  const loading = setTimeout(
    () =>
      show(
        toolbar(DISPLAY_NAME, lock, settings),
        h("main", {}, sectionTitle("Passwords"), list(h("p", { class: "empty", textContent: "Loading…" }))),
      ),
    LOADING_AFTER_MS,
  );

  const tabId = await activeTabId();
  let result: LoginsResult = { logins: [] };
  try {
    if (tabId !== undefined) result = await within(send({ type: "list-logins", tabId }));
  } catch (e) {
    error ??= messageOf(e);
  }

  let passwords: Node;
  if (!result.hostname) {
    passwords = list(h("p", { class: "empty", textContent: "Open a website to see its saved passwords." }));
  } else if (result.logins.length === 0) {
    passwords = list(h("p", { class: "empty", textContent: `No saved passwords for ${result.hostname}.` }));
  } else {
    passwords = loginList(tabId as number, result.hostname, result.logins, result.chosen);
  }

  const openApp = linkButton("Passwords app", async () => {
    await send({ type: "open-passwords-app", ...(tabId === undefined ? {} : { tabId }) }).catch(() => {});
    window.close();
  });

  const allSet = settingUp
    ? list(
        row({
          tall: true,
          lead: tile(icon(CHECK), true),
          title: "You're all set.",
          subtitle: "Click a login field on any website to fill a password.",
        }),
      )
    : null;
  settingUp = false;

  const codes = tabId === undefined || !result.hostname ? null : await oneTimeCodes(tabId);
  const unconfirmed = await unconfirmedPasswords(tabId);
  clearTimeout(loading);
  show(
    toolbar(result.hostname ? "Sign In" : DISPLAY_NAME, lock, settings),
    h(
      "main",
      {},
      allSet,
      extensionUpdate(status.extensionUpdate),
      sectionTitle("Passwords"),
      passwords,
      h("p", { class: "foot" }, "You can also look up passwords in the ", openApp, "."),
      codes,
      unconfirmed,
      errorLine(error),
    ),
  );
  app.querySelector<HTMLInputElement>(".search")?.focus();
}

/** A downloaded version waits for the session to end; installing it now ends it. */
function extensionUpdate(version: string | undefined) {
  if (!version) return null;
  const install = linkButton("Update", () => {
    // the extension restarts before it can answer
    void send({ type: "install-update" }).catch(() => {});
    window.close();
  });
  return h(
    "section",
    {},
    sectionTitle("Update"),
    list(row({ tall: true, title: `Version ${version} is ready`, trailing: install })),
    h("p", { class: "foot" }, "Updating locks Passwords Plus, so you'll enter the code again."),
  );
}

/** Logins shown before "Show more", so the settings below stay in view. */
const COLLAPSED = 3;
/** Past this many logins, a search field filters them. */
const SEARCH_AFTER = 10;

/** `chosen`: the login picked on the sign-in's previous step (listed first), shown alone at first. */
function loginList(tabId: number, hostname: string, logins: LoginsResult["logins"], chosen?: string) {
  const initial = (hostname.replace(/^www\./, "")[0] ?? "?").toUpperCase();
  const items = logins.map(({ username }) => {
    const name = username || "(no username)";
    const button = row({ as: "button", tall: true, lead: tile(initial), title: name, subtitle: hostname });
    button.title = `Fill ${username}`;
    button.addEventListener("click", () => void fill(tabId, username));
    return { name: name.toLowerCase(), username, el: button };
  });

  const collapsed = chosen === undefined ? COLLAPSED : 1;
  // hiding a single login behind a button the same size as it saves nothing, unless it's to single
  // out the chosen one
  let expanded = chosen === undefined ? items.length <= COLLAPSED + 1 : items.length <= 1;
  const others = items.length - collapsed;
  const more = row({
    as: "button",
    className: "action",
    title: chosen === undefined ? `Show ${others} more` : others === 1 ? "1 other account" : `${others} other accounts`,
  });
  const noMatches = row({ title: "No matching accounts.", className: "action" });
  noMatches.classList.add("muted");
  const search =
    items.length > SEARCH_AFTER
      ? h("input", { class: "search", type: "search", placeholder: `Search ${items.length} accounts` })
      : null;
  search?.setAttribute("aria-label", "Search accounts");

  let matches = items;
  const update = () => {
    const query = search?.value.trim().toLowerCase() ?? "";
    matches = items.filter((item) => item.name.includes(query));
    const shown = new Set(query || expanded ? matches : matches.slice(0, collapsed));
    for (const item of items) item.el.hidden = !shown.has(item);
    more.hidden = Boolean(query) || expanded;
    noMatches.hidden = matches.length > 0;
  };
  more.addEventListener("click", () => {
    expanded = true;
    update();
    items[collapsed]?.el.focus();
  });
  search?.addEventListener("input", update);
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && matches[0]) void fill(tabId, matches[0].username);
  });
  update();

  return h("div", {}, search, list(...items.map((item) => item.el), more, noMatches));
}

/** How long a code fetched for Copy waits for a second click, when the first one couldn't copy it. */
const COPY_WAIT_MS = 30_000;

/**
 * The site's verification codes. Their digits only come after Touch ID: clicking a code fills
 * the page's code field, Copy puts it on the clipboard.
 */
async function oneTimeCodes(tabId: number) {
  let result: OneTimeCodesResult;
  try {
    result = await within(send({ type: "list-one-time-codes", tabId }));
  } catch {
    return null;
  }
  if (result.codes.length === 0) return null;
  const note = h("p", { class: "foot", hidden: true });
  const say = (text: string, isError = false) => {
    note.textContent = text;
    note.className = isError ? "foot error" : "foot";
    note.hidden = !text;
  };
  const items = result.codes.map((code) => {
    const account = code.username ? `${code.username} · ${code.domain}` : code.domain;

    const copy = linkButton("Copy", () => {});
    // fetched, but the browser wouldn't let us copy it any more (Touch ID took a while)
    let waiting: { digits: string; timer: ReturnType<typeof setTimeout> } | undefined;
    const forget = () => {
      if (waiting) clearTimeout(waiting.timer);
      waiting = undefined;
    };
    const write = async (digits: string) => {
      await navigator.clipboard.writeText(digits);
      forget();
      copy.textContent = "Copied";
      say("");
    };
    copy.addEventListener("click", async (event) => {
      // Copy sits inside the row, which fills: don't let the click fill too
      event.stopPropagation();
      if (waiting) return write(waiting.digits).catch((e) => say(messageOf(e), true));
      copy.disabled = true;
      say(fetchingCode);
      try {
        const { code: digits } = await send({ type: "copy-one-time-code", tabId, id: code.id });
        await write(digits).catch(() => {
          waiting = {
            digits,
            timer: setTimeout(() => {
              forget();
              copy.textContent = "Copy";
            }, COPY_WAIT_MS),
          };
          copy.textContent = "Click to Copy";
          say("");
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "superseded") say(messageOf(e), true);
      } finally {
        copy.disabled = false;
      }
    });

    const fillRow = row({
      as: "div",
      tall: true,
      lead: tile(icon(TIMER), true),
      title: "Verification Code",
      subtitle: account,
      trailing: copy,
    });
    const fillButton = h("button", { class: "row-fill", type: "button", title: "Fill this code into the page" });
    fillButton.setAttribute("aria-label", `Fill verification code for ${account}`);
    fillRow.prepend(fillButton);
    fillRow.classList.add("fillable");
    fillButton.addEventListener("click", async () => {
      say(fetchingCode);
      try {
        const { result: filled } = await send({ type: "fill-one-time-code", tabId, id: code.id });
        if (filled === "filled") return window.close();
        say(
          filled === "no-fields"
            ? "No verification code field on this page. Copy the code instead."
            : "The page changed, try again.",
          true,
        );
      } catch (e) {
        if ((e as { code?: string }).code === "superseded") return;
        say(messageOf(e), true);
      }
    });
    return fillRow;
  });
  return h("section", { class: "codes" }, sectionTitle("Verification Codes"), list(...items), note);
}

/**
 * Generated passwords Apple Passwords may not have yet: an update it can't confirm, or a save the
 * user declined. Save asks macOS again; the password itself never reaches the popup.
 */
async function unconfirmedPasswords(tabId: number | undefined) {
  if (tabId === undefined) return null;
  const entries = await within(send({ type: "unconfirmed-passwords", tabId })).catch(() => []);
  if (entries.length === 0) return null;
  const note = h("p", { class: "foot" }, "New passwords from this session, in case one wasn't saved.");
  return h(
    "section",
    {},
    sectionTitle("Recent Passwords"),
    list(
      ...entries.map(({ id, username }) => {
        const save = linkButton("Save", async () => {
          save.disabled = true;
          try {
            await send({ type: "save-unconfirmed-password", tabId, id });
            note.className = "foot";
            note.textContent = "If Passwords already has it, macOS won't ask.";
          } catch (e) {
            note.className = "foot error";
            note.textContent = messageOf(e);
          } finally {
            save.disabled = false;
          }
        });
        return row({ title: username || "(no username)", trailing: save });
      }),
    ),
    note,
  );
}

async function fill(tabId: number, username: string) {
  try {
    const { result } = await send({ type: "fill", tabId, username });
    if (result === "filled") return window.close();
    await refresh(result === "no-fields" ? "No login fields found on this page." : "The page changed, try again.");
  } catch (e) {
    // chosen again (say, after dismissing Touch ID): that newer choice carries on
    if ((e as { code?: string }).code === "superseded") return;
    await refresh(messageOf(e));
  }
}

// --- settings ------------------------------------------------------------------------------------

type Option = (key: keyof Settings, label: string, detail?: string, disabled?: boolean) => HTMLElement;

async function showSettings(status: Status) {
  let settings: Settings;
  try {
    settings = await send({ type: "get-settings" });
  } catch (e) {
    return refresh(messageOf(e));
  }
  const option: Option = (key, label, detail, disabled = false) => {
    const toggle = h("input", {
      class: "switch",
      type: "checkbox",
      checked: !disabled && settings[key],
      disabled,
      attrs: { role: "switch" },
    });
    toggle.addEventListener("change", async () => {
      try {
        if (key === "hideMyEmail" && toggle.checked && !(await requestHideMyEmailConsent())) {
          toggle.checked = false;
          return;
        }
        await send({ type: "set-settings", settings: { [key]: toggle.checked } });
      } catch (error) {
        toggle.checked = settings[key];
        await refresh(messageOf(error));
      }
    });
    return row({
      as: "label",
      tall: Boolean(detail),
      title: label,
      ...(detail ? { subtitle: detail } : {}),
      trailing: toggle,
    });
  };

  show(
    toolbar(
      "Settings",
      tool("Back", BACK, () => void refresh()),
      null,
    ),
    h(
      "main",
      {},
      sectionTitle("Suggest Automatically"),
      list(
        option("inlineMenu", "When signing in", "Saved passwords"),
        option("oneTimeCodes", "Verification codes", "When a site asks for one"),
        option("generatePasswords", "When signing up", "Strong passwords and emails"),
        option("hideMyEmail", "Hide My Email", "iCloud+ addresses for each site"),
      ),
      // Firefox's idle API never reports "locked", so the option would do nothing there
      import.meta.env.FIREFOX
        ? null
        : h(
            "section",
            {},
            sectionTitle("Security"),
            list(option("lockOnScreenLock", `Lock when my ${computer} locks`)),
          ),
      // the companion app is Mac only; elsewhere there's nothing to offer
      status.companion === "unavailable" ? null : macAppSection(status, option),
      reportProblem(),
    ),
  );
}

/**
 * What the companion app adds. Without it (or before its setup is done), one row that gets it, with
 * its options shown greyed out, so they're discoverable but never a switch that does nothing.
 */
function macAppSection(status: Status, option: Option) {
  const ready = status.companion === "ready";
  const appIcon = h("img", { class: "tile", src: "/icon/128.png", alt: "" });
  const options = [
    option("touchId", "Enter the 6-digit code for me", "After Touch ID", !ready),
    option("suggestEmails", "Suggest my emails", "From your contact card", !ready),
  ];

  let action: HTMLButtonElement;
  let title = "Companion App";
  let subtitle = "Open it to change what it can do";
  if (ready) {
    // an app that updates itself offers the update once opened; an older one is downloaded again
    const update = status.companionUpdate;
    action = linkButton("Open", () => void openCompanion("open-companion-app"));
    if (update?.how === "app")
      action = linkButton(`Update to ${update.version}`, () => void openCompanion("open-companion-app"));
    if (update?.how === "download") action = linkButton("Update", () => void openCompanion("open-companion-page"));
  } else {
    const installed = status.companion === "needs-setup";
    title = "Skip the 6-digit code";
    subtitle = installed ? "Finish setting up the companion app" : "Touch ID enters it for you";
    // short, as a list row's trailing button is; its full name for assistive tech
    action = linkButton(
      installed ? "Set Up" : "Get",
      () => void openCompanion(installed ? "open-companion-app" : "open-companion-page"),
    );
    action.setAttribute("aria-label", installed ? "Finish Setting Up" : "Get Companion App");
  }
  return h(
    "section",
    { class: ready ? "mac-app" : "mac-app unavailable" },
    sectionTitle("Companion App"),
    list(row({ tall: true, lead: appIcon, title, subtitle, trailing: action }), ...options),
  );
}

async function openCompanion(type: "open-companion-app" | "open-companion-page") {
  await send({ type }).catch(() => {});
  window.close();
}

function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return text || "Something went wrong. Try again, or reload the extension.";
}

void platform()
  .then((os) => {
    computer = computerName(os);
    if (os === "windows") fetchingCode = "Getting the code…";
  })
  .finally(() => void refresh());
