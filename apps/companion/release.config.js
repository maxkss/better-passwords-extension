// Releases the Mac companion app from commits scoped (companion) on main
// (see scripts/release/component-commits.js). Without Developer ID secrets the disk image is ad hoc
// signed and not notarized (see scripts/release.sh).
export default {
  branches: ["main"],
  tagFormat: "companion-v${version}",
  plugins: [
    ["../../scripts/release/component-commits.js", { component: "companion", preset: "conventionalcommits" }],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "scripts/release.sh ${nextRelease.version}",
        successCmd: 'echo "version=${nextRelease.version}" >> "$GITHUB_OUTPUT"',
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [{ path: "dist/updates/*.dmg" }, { path: "dist/updates/appcast.xml" }],
        // as for the extension (apps/extension/release.config.js)
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
