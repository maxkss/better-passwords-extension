// Decides which inputs get the inline menu, and which kind. Conservative on purpose: a menu on a
// search box is noise, and suggesting saved logins on a sign-up form, or a new password on a login
// form, would be wrong. Any other email field (a newsletter, a contact form) gets email suggestions.
// A field asking for a sign-in's verification code gets the codes saved in Apple Passwords.

import { ownButtonLabels } from "./buttons.ts";
import { composedParent, isShown, rootOf } from "./dom.ts";

/**
 * "login": fill a saved login. "new-password": suggest a strong password. "email": suggest an email.
 * "one-time-code": fill a verification code.
 */
export type FieldKind = "login" | "new-password" | "email" | "one-time-code";

const USERNAME_HINT = /user|login|e-?mail|account|identifier|signin|아이디|이메일|계정|사용자/i;
/** A whole name or id for the account, not just an email (a forgot-password form's `name="username"`). */
const ACCOUNT_NAME = /^(user([_-]?(name|id))?|login([_-]?(name|id))?|identifier|sign[_-]?in)$/i;
/** A label naming the account where the field's name doesn't (Korean sites rarely name it). */
const ACCOUNT_LABEL = /^\s*(아이디|사용자\s*(이름|ID)|ID)\s*$/i;
const EMAIL_HINT = /e-?mail|이메일/i;
const SIGNUP_HINT =
  /sign[\s_-]?up|regist|create[\s_-]?(an[\s_-]?)?account|join|enrol|회원\s*가입|가입하기|계정\s*(만들기|생성)/i;
const LOGIN_HINT = /sign[\s_-]?in|log[\s_-]?in|로그인/i;
/** A sign-in's password is never optional. */
const OPTIONAL_HINT = /optional|facultati|opcional|opzionale|선택\s*사항|\(선택\)/i;
/** A field for the person's name, which only a sign-up asks for. Not "username" ("사용자 이름"). */
const PERSON_NAME =
  /(full|first|last|given|family|sur|fore)[\s_-]?name|vorname|nachname|pr[ée]nom|(?<!사용자\s*)이름|성명|성함/i;
/** A newsletter's sign-up: an email field that never signs in. */
const NEWSLETTER_HINT = /newsletter|subscri|abonn|뉴스레터|구독/i;
/** A link to reset a forgotten password: the page signs in. */
const PASSWORD_RESET = /forg[eo]t|reset|vergessen|oubli|olvid|(비밀번호|아이디)\s*(찾기|재설정)/i;

function labelText(el: HTMLInputElement): string {
  return Array.from(el.labels ?? [], (label) => label.textContent ?? "").join(" ");
}

function textOf(el: HTMLInputElement): string {
  // the label too: some fields say what they are nowhere else (no name, a generated id)
  const labels = Array.from(el.labels ?? [], (label) => label.textContent ?? "");
  return [el.name, el.id, el.getAttribute("aria-label") ?? "", el.placeholder, ...labels].join(" ");
}

/** Typed as an email, or asking for the email keyboard (a text field that takes an email). */
function asksForEmail(el: HTMLInputElement): boolean {
  return el.type === "email" || el.getAttribute("inputmode")?.toLowerCase() === "email";
}

/**
 * A search box that isn't typed as one: Outlook's says "Search for email, meetings, files and more",
 * which would otherwise pass for an email field.
 */
function isSearchBox(el: HTMLInputElement): boolean {
  if (/search/.test(el.autocomplete.toLowerCase()) || el.getAttribute("role") === "searchbox") return true;
  return el.closest("search, [role=search]") !== null || /search|검색/i.test(textOf(el));
}

/** Says it wants a sign-in's verification code, whatever the field looks like. */
const CODE_LABEL =
  /one[\s_-]?time|(?<![a-z])(t?otp|2fa|mfa)(?![a-z])|two[\s_-]?(factor|step)|2[\s_-]?step|verification|authenticat(ion|or)|security[\s_-]?code|passcode|인증\s*(번호|코드)|일회용|보안\s*코드|2단계/i;
/** Might be a verification code, if the field also takes a short number. Names use _ and - too. */
const MAYBE_CODE_LABEL = /(?<![a-z])code(?![a-z])|verify|token|코드|인증/i;
/** Codes of other kinds: payment cards, addresses, phones, offers, captchas, recovery codes. */
const NOT_CODE_LABEL =
  /card|cvc|cvv|csc|post(al)?[\s_-]?code|zip|phone|mobile|promo|coupon|voucher|gift|referral|invit|discount|area[\s_-]?code|country|captcha|recovery|backup|카드|우편|휴대폰|전화|쿠폰|추천|초대|할인|복구|자동입력\s*방지/i;

/** Inputs a code goes into: text-like, or typed as a number. */
function takesCode(el: HTMLInputElement): boolean {
  return ["text", "tel", "number", ""].includes(el.type);
}

/** Asks for a short number: what a code field does even when it isn't named for one. */
function asksForShortNumber(el: HTMLInputElement): boolean {
  const pattern = el.getAttribute("pattern") ?? "";
  return (
    el.getAttribute("inputmode")?.toLowerCase() === "numeric" ||
    el.type === "number" ||
    el.type === "tel" ||
    (el.maxLength >= 4 && el.maxLength <= 8) ||
    /^(\\d|\[0-9\])/.test(pattern)
  );
}

/** The page says it's asking for a code: its title or headings, as on a two-factor step. */
function pageAsksForCode(doc: Document): boolean {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3"), (h) => h.textContent ?? "");
  return CODE_LABEL.test([doc.title, ...headings].join(" "));
}

/** On a payment form any short code is a card's (its CVC), never a sign-in's. */
function inPaymentForm(el: HTMLInputElement): boolean {
  return Array.from(scopeOf(el).querySelectorAll("input")).some((input) =>
    /\bcc-/.test(input.autocomplete.toLowerCase()),
  );
}

/**
 * The boxes of a code split into one box per digit, in order, when `el` is one of them: 4 to 8
 * one-character inputs under its parent or a close ancestor. Otherwise just `el`.
 */
export function oneTimeCodeGroup(el: HTMLInputElement): HTMLInputElement[] {
  if (el.maxLength !== 1) return [el];
  let scope: HTMLElement | null = el.parentElement;
  for (let depth = 0; scope && depth < 3; depth++, scope = scope.parentElement) {
    const boxes = Array.from(scope.querySelectorAll("input")).filter(
      (input) => input.maxLength === 1 && takesCode(input) && !input.disabled && !input.readOnly,
    );
    if (boxes.length >= 4 && boxes.length <= 8) return boxes;
  }
  return [el];
}

/** A field for a sign-in's verification code (from an authenticator, as Apple Passwords is one). */
export function isOneTimeCodeField(el: HTMLInputElement): boolean {
  if (!takesCode(el)) return false;
  if (tokens(el).includes("one-time-code")) return true;
  if (/cc-|address|tel|postal|email|username|password/.test(el.autocomplete.toLowerCase())) return false;
  if (NOT_CODE_LABEL.test(textOf(el)) || isSearchBox(el) || inPaymentForm(el)) return false;
  if (oneTimeCodeGroup(el).length > 1) return true;
  const text = textOf(el);
  if (CODE_LABEL.test(text)) return true;
  if (!asksForShortNumber(el)) return false;
  return MAYBE_CODE_LABEL.test(text) || pageAsksForCode(el.ownerDocument);
}

function isTextLike(el: HTMLInputElement): boolean {
  return ["text", "email", "tel", ""].includes(el.type);
}

function tokens(el: HTMLInputElement): string[] {
  return el.autocomplete.toLowerCase().split(/\s+/);
}

/** Where the fields filled along with `el` are: its form, or the document or shadow root it's in. */
function scopeOf(el: HTMLInputElement): ParentNode {
  return el.form ?? rootOf(el);
}

/**
 * The password fields in `scope` someone can see (and `el`, the field being asked about): fields
 * nobody can see are traps or leftovers, and would make a sign-in look like a sign-up.
 */
function passwordFields(scope: ParentNode, el?: HTMLInputElement): HTMLInputElement[] {
  return Array.from(scope.querySelectorAll("input")).filter(
    (input) => input.type === "password" && (input === el || isShown(input)),
  );
}

function ownText(form: HTMLFormElement): string {
  return [form.id, form.name, form.getAttribute("action") ?? "", form.className].join(" ");
}

/** What the form's own buttons say: not "Sign in with Google", which is about another account. */
function buttonText(form: HTMLFormElement): string {
  return ownButtonLabels(form);
}

/** A form that creates an account, judged by its own attributes and its submit buttons. */
function looksLikeSignup(form: HTMLFormElement | null): boolean {
  if (!form) return false;
  const buttons = buttonText(form);
  return SIGNUP_HINT.test(`${ownText(form)} ${buttons}`) && !LOGIN_HINT.test(buttons);
}

/** A form that signs in, judged the same way (a sign-in's first step, before the password). */
function looksLikeLogin(form: HTMLFormElement | null): boolean {
  if (!form) return false;
  return LOGIN_HINT.test(`${ownText(form)} ${buttonText(form)}`);
}

/**
 * The fields filled along with `el`: its form, or for fields outside any form the nearest element
 * around it holding another field (not the whole page: a profile's name fields are no sign-up).
 */
function fieldsAround(el: HTMLInputElement): HTMLInputElement[] {
  if (el.form) return Array.from(el.form.querySelectorAll("input")).filter((input) => input === el || isShown(input));
  for (let scope = composedParent(el); scope && scope !== el.ownerDocument.body; scope = composedParent(scope)) {
    const inputs = Array.from(scope.querySelectorAll("input")).filter((input) => input === el || isShown(input));
    if (inputs.length > 1) return inputs;
  }
  return [el];
}

/** A field for the person's name: marked as one, or named or labelled for one. */
function isPersonNameField(el: HTMLInputElement): boolean {
  if (!isTextLike(el)) return false;
  if (tokens(el).some((token) => ["name", "given-name", "family-name"].includes(token))) return true;
  return /^(full[_-]?)?name$/i.test(el.name) || PERSON_NAME.test(textOf(el));
}

/** A password field that should get a new password: sign-up, confirmation or change-password. */
export function isNewPasswordField(el: HTMLInputElement): boolean {
  if (el.type !== "password") return false;
  const autocomplete = tokens(el);
  if (autocomplete.includes("new-password")) return true;
  if (autocomplete.includes("current-password")) return false;
  const all = passwordFields(scopeOf(el), el);
  const marked = all.some((input) => tokens(input).includes("current-password"));
  // two password fields: password and confirmation; three: current, new and confirmation
  if (all.length === 2 && !marked) return true;
  if (all.length >= 3) return all.indexOf(el) > 0;
  // a sign-up's too: an optional password, or one asked for along with the person's name
  if (OPTIONAL_HINT.test(textOf(el)) || fieldsAround(el).some(isPersonNameField)) return true;
  return looksLikeSignup(el.form);
}

export function isPasswordField(el: HTMLInputElement): boolean {
  return el.type === "password" && !isNewPasswordField(el);
}

/** The page (or the shadow root around `field`) links to resetting a forgotten password, as sign-ins do. */
function offersPasswordReset(field: HTMLInputElement): boolean {
  return [...new Set<ParentNode>([rootOf(field), field.ownerDocument])].some((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("a, button")).some((el) => PASSWORD_RESET.test(el.textContent ?? "")),
  );
}

/**
 * A sign-in's password field, as far as anyone can tell, but nothing says it's one: no
 * `current-password`, no sign-in button, no forgotten-password link. Could be a sign-up's, so
 * with no saved logins for the site a strong password is suggested instead.
 */
export function isUnsurePasswordField(el: HTMLInputElement): boolean {
  if (!isPasswordField(el) || tokens(el).includes("current-password")) return false;
  return !looksLikeLogin(el.form) && !offersPasswordReset(el);
}

/** A password field a new password may go into: a sign-up's, or one that might be. */
export function mayTakeNewPassword(el: HTMLInputElement): boolean {
  return isNewPasswordField(el) || isUnsurePasswordField(el);
}

function inSignupForm(el: HTMLInputElement): boolean {
  return passwordFields(scopeOf(el)).some(isNewPasswordField) || looksLikeSignup(el.form);
}

/**
 * An email field that may sign in, for all anyone can tell: outside any sign-up form or newsletter
 * (a sign-in by a code sent by email, or one page for signing in and up). The site's logins are
 * offered there, or unlocking for them.
 */
export function maySignIn(el: HTMLInputElement): boolean {
  if (inSignupForm(el)) return false;
  const form = el.form ? `${ownText(el.form)} ${buttonText(el.form)}` : "";
  return !NEWSLETTER_HINT.test(`${textOf(el)} ${form}`);
}

function hasPasswordFieldNearby(el: HTMLInputElement): boolean {
  return passwordFields(scopeOf(el)).some((input) => isPasswordField(input));
}

function isEmailLike(el: HTMLInputElement): boolean {
  const autocomplete = tokens(el);
  return asksForEmail(el) || autocomplete.includes("email") || EMAIL_HINT.test(textOf(el));
}

/**
 * A username field: explicitly marked, username-like and next to a password field, or on its own
 * (a sign-in's first step, a forgot-password form) when it's named for the account or its form signs in.
 */
export function isUsernameField(el: HTMLInputElement): boolean {
  if (!isTextLike(el)) return false;
  const autocomplete = el.autocomplete.toLowerCase();
  if (/one-time-code|new-password|cc-|address|search/.test(autocomplete)) return false;
  if (tokens(el).includes("username")) return true;
  if (!hasPasswordFieldNearby(el)) {
    // the whole name or id only: "user[first_name]" or a label saying "Username" is no account field
    if (ACCOUNT_NAME.test(el.name) || ACCOUNT_NAME.test(el.id)) return true;
    return (isEmailLike(el) || ACCOUNT_LABEL.test(labelText(el))) && looksLikeLogin(el.form);
  }
  return autocomplete.includes("email") || asksForEmail(el) || USERNAME_HINT.test(textOf(el));
}

export function fieldKind(target: EventTarget | null): FieldKind | undefined {
  if (!(target instanceof HTMLInputElement) || target.disabled || target.readOnly) return undefined;
  if (target.type === "password") return isNewPasswordField(target) ? "new-password" : "login";
  if (isOneTimeCodeField(target)) return "one-time-code";
  if (!isTextLike(target)) return undefined;
  if (/one-time-code|cc-|address/.test(target.autocomplete.toLowerCase()) || isSearchBox(target)) return undefined;
  // on a sign-up form, the email field gets email suggestions instead of saved logins
  if (inSignupForm(target)) return isEmailLike(target) ? "email" : undefined;
  if (isUsernameField(target)) return "login";
  // any other email field (a newsletter, a contact form): the user's own emails, or Hide My Email
  return isEmailLike(target) ? "email" : undefined;
}

export function isLoginField(target: EventTarget | null): target is HTMLInputElement {
  return fieldKind(target) === "login";
}
