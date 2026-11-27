// Which buttons send a form. A form's buttons say what it does ("Sign in", "Create account"), but
// not all of them send it: "Sign in with Google" leaves for another account (single sign-on), and
// sites draw their real button as a styled div as often as a <button>.

import { composedParent } from "./dom.ts";

/**
 * A button that signs in with another account instead of this form: an identity provider's, a
 * company's single sign-on, a passkey or a QR code. Its words say nothing about the form.
 */
const SSO_TEXT =
  /(?<![a-z])(google|apple|facebook|meta|microsoft|github|gitlab|twitter|linkedin|amazon|yahoo|discord|slack|okta|kakao|naver|line|sso|saml|passkeys?|qr)(?![a-z])|single[\s_-]?sign[\s_-]?on|카카오|네이버|구글|애플|페이스북|패스키|간편[\s_-]?로그인|QR/i;

/** Words of a button that sends a sign-in or sign-up, for elements that aren't buttons. */
const SEND_TEXT =
  /^(sign[\s_-]?(in|on|up)|log[\s_-]?(in|on)|login|continue|next|submit|go|ok|register|join|create (an )?account|로그인|로그인하기|다음|계속|계속하기|확인|가입|가입하기|회원 ?가입)$/i;

/** Longer than this, an element's text is content, not a button's label. */
const MAX_LABEL = 24;

const BUTTONS = "button, input[type=submit], input[type=image], input[type=button], [role=button]";

/** What a button says: its value, its accessible name, or its text. */
export function labelOf(el: Element): string {
  const value = el instanceof HTMLInputElement ? el.value : "";
  return (value || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
}

/** A button that signs in with another account (see SSO_TEXT), so its words don't count. */
export function isSsoButton(el: Element): boolean {
  return SSO_TEXT.test(labelOf(el)) || SSO_TEXT.test(el.getAttribute("title") ?? "");
}

/** A link to another page: following it leaves the form behind, whatever it says. */
function isNavigationLink(el: Element): boolean {
  const href = el.getAttribute("href");
  return el.localName === "a" && href !== null && !/^(#|javascript:)/i.test(href);
}

/** An element drawn as a button by the page itself: clickable, and labelled like one. */
function looksLikeButton(el: Element): boolean {
  if (isNavigationLink(el)) return false;
  const label = labelOf(el);
  if (label === "" || label.length > MAX_LABEL || !SEND_TEXT.test(label)) return false;
  return getComputedStyle(el).cursor === "pointer";
}

/**
 * The button a click on `target` pressed, if it sends a form: a button element or one with the
 * button role, or failing that an element a few levels up that the page made look like one. A
 * single sign-on button sends nothing: undefined.
 */
export function senderOf(target: Element): Element | undefined {
  const button = target.closest(BUTTONS);
  if (button) return isSsoButton(button) ? undefined : button;
  let el: Element | null = target;
  for (let depth = 0; el && depth < 5 && el !== el.ownerDocument.body; depth++, el = composedParent(el)) {
    if (looksLikeButton(el)) return el;
  }
  return undefined;
}

/** The labels of the buttons in `scope` that speak for it: all but the single sign-on ones. */
export function ownButtonLabels(scope: ParentNode): string {
  return Array.from(scope.querySelectorAll<HTMLElement>("button, input[type=submit]"))
    .filter((el) => !isSsoButton(el))
    .map(labelOf)
    .join(" ");
}
