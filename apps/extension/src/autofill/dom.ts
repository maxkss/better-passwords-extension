// What the page shows and where its fields are, across shadow roots. Sites build sign-ins out of
// web components (fields in a shadow root, open or closed) and leave fields nobody can see (bot
// traps, the other step of a multi-step form); neither may change what a form is taken for.

/** Below this, in either direction, a field is a trap or a leftover, not something to type in. */
const MIN_SIZE = 2;

/** The menu's own element, whose closed shadow root holds our frame: never looked into. */
const OWN_HOST = "app-autofill-menu";

/** The document or shadow root `el` lives in: where to look for the fields around it. */
export function rootOf(el: Node): Document | ShadowRoot {
  const root = el.getRootNode();
  return root instanceof ShadowRoot || root instanceof Document ? root : (el.ownerDocument ?? document);
}

/** `el`'s parent, or the host of its shadow root when it's at the top of one. */
export function composedParent(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

type ClosedRootApi = { openOrClosedShadowRoot?: (el: HTMLElement) => ShadowRoot | null };

/**
 * The shadow root `el` hosts, open or closed. Only extensions can see closed ones: Firefox gives
 * content scripts `element.openOrClosedShadowRoot()`, Chromium `chrome.dom.openOrClosedShadowRoot`.
 */
export function shadowRootOf(el: Element): ShadowRoot | null {
  if (el.shadowRoot) return el.shadowRoot;
  if (!(el instanceof HTMLElement) || el.localName === OWN_HOST || !el.localName.includes("-")) return null;
  const firefox = (el as unknown as { openOrClosedShadowRoot?: () => ShadowRoot | null }).openOrClosedShadowRoot;
  if (typeof firefox === "function") return firefox.call(el) ?? null;
  const chromium = (globalThis as { chrome?: { dom?: ClosedRootApi } }).chrome?.dom;
  return chromium?.openOrClosedShadowRoot?.(el) ?? null;
}

/** Follows focus down through shadow roots to the element that really has it. */
function focusedWithin(el: Element | null): Element | null {
  let current = el;
  for (let depth = 0; current && depth < 16; depth++) {
    if (current.localName === OWN_HOST) return current;
    const inner = shadowRootOf(current)?.activeElement;
    if (!inner) return current;
    current = inner;
  }
  return current;
}

/** The focused element, inside shadow roots too (the page sees only their hosts). */
export function deepActiveElement(doc: Document = document): Element | null {
  return focusedWithin(doc.activeElement);
}

/**
 * What an event really happened to. A listener on the document sees a field in a shadow root as
 * its host: an open root still tells through `composedPath`, a closed one only through focus.
 */
export function deepTarget(event: Event): EventTarget | null {
  const first = event.composedPath()[0] ?? event.target;
  if (!(first instanceof Element) || first.localName === OWN_HOST) return first;
  // a host of a closed root: what the event was for is focused inside it
  return shadowRootOf(first) && !first.shadowRoot ? focusedWithin(first) : first;
}

/** Whether the page lays itself out: not in a test DOM, which has no sizes and positions. */
function hasLayout(doc: Document): boolean {
  return doc.documentElement.getBoundingClientRect().width > 0;
}

/**
 * Whether someone could see `el` and type in it: displayed and opaque all the way up, of a usable
 * size, and not pushed off the page's left or top edge (where nobody can scroll).
 */
export function isShown(el: Element): boolean {
  if (!el.isConnected || (el instanceof HTMLInputElement && el.type === "hidden")) return false;
  if (typeof el.checkVisibility === "function") {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  } else {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) {
      return false;
    }
  }
  const doc = el.ownerDocument;
  if (!hasLayout(doc)) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return false;
  const view = doc.defaultView;
  return !(rect.right + (view?.scrollX ?? 0) <= 0 || rect.bottom + (view?.scrollY ?? 0) <= 0);
}
