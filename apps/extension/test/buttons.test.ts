import { describe, expect, it } from "vitest";
import { isSsoButton, ownButtonLabels, senderOf } from "../src/autofill/buttons.ts";

function page(html: string): void {
  document.body.innerHTML = html;
}

const el = (selector: string) => document.querySelector(selector) as HTMLElement;

describe("isSsoButton", () => {
  it.each([
    "Sign in with Google",
    "Continue with Apple",
    "Log in with Facebook",
    "Sign in with SSO",
    "Use single sign-on",
    "Sign in with a passkey",
    "카카오로 시작하기",
    "네이버 로그인",
    "QR 코드로 로그인",
  ])("takes %s for signing in with another account", (text) => {
    page(`<button id="b">${text}</button>`);
    expect(isSsoButton(el("#b"))).toBe(true);
  });

  it.each(["Sign in", "Continue", "Create account", "로그인", "Sign in online", "Applesauce club"])(
    "takes %s for the form's own",
    (text) => {
      page(`<button id="b">${text}</button>`);
      expect(isSsoButton(el("#b"))).toBe(false);
    },
  );

  it("reads an icon button's accessible name", () => {
    page(`<button id="b" aria-label="Sign in with Google"><svg></svg></button>`);
    expect(isSsoButton(el("#b"))).toBe(true);
  });
});

describe("ownButtonLabels", () => {
  it("leaves out single sign-on buttons", () => {
    page(`<form id="f"><button>Create account</button><button type="button">Sign in with Google</button></form>`);
    expect(ownButtonLabels(el("#f"))).toBe("Create account");
  });
});

describe("senderOf", () => {
  it("is the button clicked, or the one around what was clicked", () => {
    page(`<form><button id="b"><span id="s">Sign in</span></button></form>`);
    expect(senderOf(el("#s"))).toBe(el("#b"));
  });

  it("is nothing for a single sign-on button", () => {
    page(`<form><button id="b"><span id="s">Continue with Google</span></button></form>`);
    expect(senderOf(el("#s"))).toBeUndefined();
  });

  it("finds a div the page made into a button", () => {
    page(`<div><div id="go" style="cursor: pointer"><span id="s">Sign in</span></div></div>`);
    // the span inherits the pointer: it or the div, either leads to the same fields
    const sender = senderOf(el("#s"));
    expect(sender && el("#go").contains(sender)).toBe(true);
  });

  it("finds a Korean one", () => {
    page(`<div id="go" style="cursor: pointer">로그인</div>`);
    expect(senderOf(el("#go"))).toBe(el("#go"));
  });

  it.each([
    ["a div that doesn't look clickable", `<div id="go">Sign in</div>`],
    ["a link to another page", `<a id="go" href="/login" style="cursor: pointer">Sign in</a>`],
    ["a long text", `<p id="go" style="cursor: pointer">Sign in to see your orders and track deliveries</p>`],
    ["a label that sends nothing", `<div id="go" style="cursor: pointer">Help</div>`],
  ])("is nothing for %s", (_, html) => {
    page(html);
    expect(senderOf(el("#go"))).toBeUndefined();
  });
});
