# VS Code API compatibility

## Support policy

Forma supports a rolling 90-day window of stable VS Code releases. At each review, select the stable minor series that was current 90 calendar days before the review date, and use its latest available patch as the minimum. Support that minimum and subsequent stable versions; Insiders is not a release gate. Patch updates do not count as separate minor series.

Review the floor monthly when preparing a Forma release. Record the review date, cutoff, release-date evidence, and chosen minimum here. Apply an approved change in the next Forma release; published extension manifests remain immutable. A delayed release may retain the previous, wider window. Do not advance the floor automatically during installation, builds, or ordinary dependency updates. A necessary API or dependency outside the window requires an explicit support-policy exception and release note.

The extension manifest's `engines.vscode` is the executable minimum-version authority. `scripts/vscode-compatibility.mjs` reads it for trusted Extension Host tests, untrusted-workspace tests, and the default packaged-VSIX smoke test. Prefer `@types/vscode` on the same major/minor API series. When that series has no published declarations, use the closest earlier published series; never compile against a later API series. Declaration patch versions do not need to match editor patch versions.

## Current baseline

- Reviewed on 2026-11-17. Review again during December 2026 release preparation.
- The 90-day window starts on 2026-08-19. VS Code 1.134 was released that day, and 1.135 followed on 2026-08-26.
- The minimum is `engines.vscode: ^1.134.0`. The official stable release list contains 1.134.0 as the latest patch in the series as of the review.
- The extension uses `@types/vscode: ~1.134.0`, matching the minimum editor's API series.

This is a product support decision, not a newly required extension API. The extension uses stable workspace, trust, diagnostics, language-provider, Tree View, native Markdown Preview, and theme APIs. The runtime bundle retains Node 18-compatible syntax; changing the editor floor does not require changing the bundle target.

## Validation and compatibility reports

Run trusted Extension Host integration tests on the exact minimum and current stable, plus untrusted-workspace tests and packaged-VSIX installation/activation at the minimum. Record the actual stable version resolved for release evidence. Supported intermediate versions are not all included in routine CI; investigate reported regressions within the supported window and add targeted coverage when needed. Download or runner failures are blocked runtime evidence, not a compatibility pass.

For each target, reuse an installed official stable VS Code only when its exact version matches the target. Resolve `stable` through the official release API before comparing; a failed lookup must not silently substitute an older editor. Standard macOS, Windows, and Linux installation locations are checked without launching or modifying the user application. Reuse only the executable, with isolated test user-data and extension directories. If no exact match is found, use the test cache or download the target. The explicit `VSCODE_EXECUTABLE_PATH` override remains available for untrusted and VSIX diagnostics; callers are responsible for its version.

Downloaded VS Code binaries are retained in the Git-ignored `extensions/vscode/.vscode-test/` cache across test runs, including the minimum supported version. Reuse the cached binary during ordinary iteration; do not remove this cache as part of test cleanup. Only disposable test workspaces, extension installations, and user-data directories are removed after a run. Remove cached binaries only during an explicit cache-maintenance operation.

Older editors cannot install the new extension release. Users must upgrade VS Code to receive it; this policy does not change the compatibility metadata of previously published Forma releases.

References:

- [Weekly stable release cadence](https://code.visualstudio.com/blogs/2026/03/13/how-VS-Code-Builds-with-AI)
- [VS Code 1.134 release](https://code.visualstudio.com/updates/v1_134)
- [VS Code 1.135 release](https://code.visualstudio.com/updates/v1_135)
- [VS Code stable release list](https://update.code.visualstudio.com/api/releases/stable)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
