// Shared product identity. Browser packages and download routes use the same configuration.

export const DISPLAY_NAME = "Passwords Plus";
export const STORE_TITLE = "Passwords Plus - for Apple Passwords";

export const REPO_URL = "https://github.com/maxkss/better-passwords-extension";
export const SETUP_COMMAND = `curl -fsSL ${REPO_URL}/raw/main/scripts/setup-mac.sh | sh`;
/** The same setup on Windows, for PowerShell. */
export const WINDOWS_SETUP_COMMAND = `irm ${REPO_URL}/raw/main/scripts/setup-windows.ps1 | iex`;
/** Apple Passwords on Windows comes with this app (and its password helper). */
export const ICLOUD_FOR_WINDOWS_URL = "https://apps.microsoft.com/detail/9PKTQ5699M62";

/**
 * Our own registration of Apple's helper, written by scripts/setup-mac.sh or the companion app on a
 * Mac, and by scripts/setup-windows.ps1 on Windows.
 */
export const BRIDGE_HOST = "io.github.maxkss.passwordsplus.bridge";

/** The optional Touch ID companion app's own native host (see apps/companion). */
export const COMPANION_HOST = "io.github.maxkss.passwordsplus.companion";

export const HELPER_PATH =
  "/System/Cryptexes/App/System/Library/CoreServices/PasswordManagerBrowserExtensionHelper.app/Contents/MacOS/PasswordManagerBrowserExtensionHelper";

/**
 * This fork's own public key, so every unpacked build gets the same extension ID (EXTENSION_ID),
 * which the native host manifests allow. Store ZIPs omit the key field.
 */
export const EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4UzIAcUywMEzpDBGPrIMuPdG10YU0v97DXfu09GWlKIwkyUS8TyWPmoD8RMu6qm6NNiNDy9sHQCP/K2nhtD2fzDyBvBd5Lc2n3PSzBcjjsWlzqWujgFgDjho86VbbbX4nYgm0NRlhrFeTiCX9qymUPclx+iSTHKBwhGCO0Y8nFdpJO2UPzCqOhTb/5VlhOVwgBipivdZL6ksT4e2a6e8AXOtyIBAwMuMz7SDuS0h+sNHhZ1GG2YLJ3V39LM79MbcHrW6kbV1Ju1fIu3bhA8SIeCynFtBeuyqvZqwPg95SwdrUCe3nZBJV5Ng9VBci0FEfdTo1FnF4VapHsF2azFwhwIDAQAB";

export const EXTENSION_ID = "dldapmofalpjbidlgmmjkiikhhckemlo";
export const FIREFOX_EXTENSION_ID = "passwords-plus@maxkss.github.io";

/** Pages where the inline menu runs and passwords may be filled (see src/url-policy.ts). */
export const FILL_MATCHES = ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"];

/**
 * The optional companion app's newest disk image. CI copies each companion-v* release's disk image
 * to the fixed "mac-app" release under this name (scripts/release/mac-app.sh).
 */
export const COMPANION_DOWNLOAD_URL = `${REPO_URL}/releases/download/mac-app/passwords-plus-mac.dmg`;

/**
 * Opens the companion app, which then connects the browser that opened it. Its scheme is in the
 * app's Info.plist. Without the app, browsers ignore it (see openCompanionLink in src/ui/setup.ts).
 */
export const COMPANION_CONNECT_URL = "passwordsplus://connect";
