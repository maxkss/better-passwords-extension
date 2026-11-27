// How a passphrase is made, as the user sets it in the popup. Apart from the generator (which runs
// in the background worker and carries the word list) so settings can name the defaults cheaply.

/** How a passphrase is made, as the user set it (see PASSPHRASE_DEFAULTS). */
export interface PassphraseOptions {
  /** How many words, MIN_WORDS to MAX_WORDS. */
  words: number;
  /** What goes between the words: up to 3 printable characters, or nothing. */
  separator: string;
  /** Capitalize one word. */
  capital: boolean;
  /** Put a digit after one word. */
  digit: boolean;
}

/** Six words with a capital and a digit: about 85 bits, as strong as the default password. */
export const PASSPHRASE_DEFAULTS: PassphraseOptions = { words: 6, separator: "-", capital: true, digit: true };
export const MIN_WORDS = 3;
export const MAX_WORDS = 10;
export const MAX_SEPARATOR = 3;

/** The options as given, or the defaults for anything out of range (an old or tampered setting). */
export function passphraseOptions(options: Partial<PassphraseOptions> = {}): PassphraseOptions {
  const { words, separator, capital, digit } = { ...PASSPHRASE_DEFAULTS, ...options };
  const separatorOk =
    typeof separator === "string" && separator.length <= MAX_SEPARATOR && /^[\x20-\x7e]*$/.test(separator);
  return {
    words: Number.isInteger(words) && words >= MIN_WORDS && words <= MAX_WORDS ? words : PASSPHRASE_DEFAULTS.words,
    separator: separatorOk ? separator : PASSPHRASE_DEFAULTS.separator,
    capital: typeof capital === "boolean" ? capital : PASSPHRASE_DEFAULTS.capital,
    digit: typeof digit === "boolean" ? digit : PASSPHRASE_DEFAULTS.digit,
  };
}
