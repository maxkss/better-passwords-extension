import "./style.css";
import { COMPANION_DOWNLOAD_URL, REPO_URL } from "@/src/config.ts";
import { send } from "@/src/messages.ts";
import { applySystemAccent } from "@/src/ui/accent.ts";
import { h } from "@/src/ui/h.ts";
import { ACCESSIBILITY, icon, PERSON, TOUCH_ID } from "@/src/ui/icons.ts";

// What the optional Mac app adds, in plain words, with what it asks for and one way to get it.
// Every "Get Companion App" in the extension opens this page.

applySystemAccent();

const page = document.getElementById("page") as HTMLElement;

/** A row of a grouped list: a symbol on a coloured tile, a title, a line under it. */
function feature(path: string, tint: string, title: string, detail: string) {
  return h(
    "li",
    { class: "row" },
    h("span", { class: `tile ${tint}`, attrs: { "aria-hidden": "true" } }, icon(path)),
    h("span", { class: "body" }, h("strong", { textContent: title }), h("span", { textContent: detail })),
  );
}

async function render() {
  const status = await send({ type: "get-status" }).catch(() => undefined);
  const installed = status?.companion === "ready" || status?.companion === "needs-setup";
  const update = installed ? status?.companionUpdate : undefined;
  // an app from before updates were built in is replaced by downloading the new one
  const download = !installed || update?.how === "download";
  let label = installed ? "Open Companion App" : "Download for Mac";
  if (update) label = update.how === "download" ? "Download the Update" : `Update to ${update.version}`;

  const primary = h("a", {
    class: "button primary",
    href: download ? COMPANION_DOWNLOAD_URL : "#",
    textContent: label,
  });
  if (!download) {
    primary.addEventListener("click", async (event) => {
      event.preventDefault();
      await send({ type: "open-companion-app" }).catch(() => {});
    });
  }

  page.replaceChildren(
    h("img", { class: "app-icon", src: "/icon/128.png", alt: "" }),
    h("h1", { textContent: "Companion app for Mac" }),
    h("p", { class: "lead", textContent: "Optional and free. It makes Passwords Plus a little smoother." }),
    h("h2", { textContent: "What it adds" }),
    h(
      "ul",
      { class: "list" },
      feature(
        TOUCH_ID,
        "accent",
        "Skip the 6-digit code",
        "Confirm with Touch ID, and the code your Mac shows is entered for you.",
      ),
      feature(
        PERSON,
        "gray",
        "Suggest my emails",
        "Email fields offer the email addresses on your contact card, like Safari.",
      ),
    ),
    h("h2", { textContent: "What it asks for" }),
    h(
      "ul",
      { class: "list" },
      feature(TOUCH_ID, "red", "Touch ID", "Every time it enters a code for you."),
      feature(
        ACCESSIBILITY,
        "blue",
        "Accessibility",
        "Only to read the code in Apple's own code window. Your browser never gets it.",
      ),
      feature(PERSON, "gray", "Contacts (optional)", "Only your own card."),
    ),
    h(
      "div",
      { class: "actions" },
      primary,
      h("a", { class: "text-link", href: `${REPO_URL}/blob/main/docs/companion.md`, textContent: "How It Works" }),
    ),
    h("p", {
      class: "fine",
      textContent: "Free and open source. It runs in the background only when the extension needs it.",
    }),
  );
}

void render();
