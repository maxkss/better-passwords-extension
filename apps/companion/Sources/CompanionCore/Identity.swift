// Names and identities shared by the app, the agent and the native host. The extension IDs and
// host names must match apps/extension/src/config.ts and scripts/setup-mac.sh.

public enum Identity {
    /// Bundle identifier and code-signing identifier of the app (and of its agent mode).
    public static let appBundleID = "io.github.maxkss.passwordsplus.companion"
    /// Code-signing identifier of the native-messaging host inside the app bundle.
    public static let hostSigningID = "io.github.maxkss.passwordsplus.companion.host"
    /// launchd label of the agent, and the XPC service it vends.
    public static let agentService = "io.github.maxkss.passwordsplus.agent"
    /// File name of the agent's launchd plist inside Contents/Library/LaunchAgents.
    public static let agentPlistName = "io.github.maxkss.passwordsplus.agent.plist"
    /// Executable name of the native host, inside Contents/MacOS.
    public static let hostExecutableName = "passwords-plus-host"

    /// Native host that reaches the companion (for Touch ID).
    public static let companionHost = "io.github.maxkss.passwordsplus.companion"
    /// Native host that reaches Apple's helper (what setup-mac.sh writes).
    public static let bridgeHost = "io.github.maxkss.passwordsplus.bridge"

    /// Our Chromium extension ID, shared by store and unpacked installations.
    public static let extensionID = "dldapmofalpjbidlgmmjkiikhhckemlo"
    public static let firefoxExtensionID = "passwords-plus@maxkss.github.io"

    public static let helperPath =
        "/System/Cryptexes/App/System/Library/CoreServices/PasswordManagerBrowserExtensionHelper.app/Contents/MacOS/PasswordManagerBrowserExtensionHelper"
    /// What Apple's helper must satisfy before we read anything from its windows.
    public static let helperRequirement =
        #"anchor apple and identifier "com.apple.PasswordManagerBrowserExtensionHelper""#

    /// Info.plist key holding the native host's cdhash in ad-hoc (development) builds, written by
    /// scripts/bundle.sh. Signed release builds check the team ID instead.
    public static let hostCDHashKey = "BPHostCDHash"
}
