# VS Code API compatibility

## Support policy

Forma supports a rolling 90-day window of stable VS Code releases. At each review, select the stable minor series that was current 90 calendar days before the review date, and use its latest available patch as the minimum. Support that minimum and subsequent stable versions; Insiders is not a release gate. Patch updates do not count as separate minor series.

Review the floor monthly when preparing a Forma release. Record the review date, cutoff, release-date evidence, and chosen minimum here. Apply an approved change in the next Forma release; published extension manifests remain immutable. A delayed release may retain the previous, wider window. Do not advance the floor automatically during installation, builds, or ordinary dependency updates. A necessary API or dependency outside the window requires an explicit support-policy exception and release note.

The extension manifest's `engines.vscode` is the executable minimum-version authority. `scripts/vscode-compatibility.mjs` reads it for trusted Extension Host tests, untrusted-workspace tests, and the default packaged-VSIX smoke test. Prefer `@types/vscode` on the same major/minor API series. When that series has no published declarations, use the closest earlier published series; never compile against a later API series. Declaration patch versions do not need to match editor patch versions.

## Current baseline

- Reviewed: 2026-09-05; next review: October 2026 release preparation.
- Window cutoff: 2026-06-07 (90 days before review).
- Selected series: 1.123, released 2026-06-03; 1.124 followed on 2026-06-10.
- Minimum: `engines.vscode: ^1.123.2`, using the available 1.123 maintenance patches.
- Types: `@types/vscode: ~1.120.0`; the npm registry has no 1.123 declarations (adjacent published series: 1.120 and 1.125, verified 2026-09-05).

This is a product support decision, not a newly required extension API. The extension uses stable workspace, trust, diagnostics, language-provider, Tree View, native Markdown Preview, and theme APIs. The runtime bundle retains Node 18-compatible syntax; changing the editor floor does not require changing the bundle target.

## Validation and compatibility reports

Run trusted Extension Host integration tests on the exact minimum and current stable, plus untrusted-workspace tests and packaged-VSIX installation/activation at the minimum. Record the actual stable version resolved for release evidence. Supported intermediate versions are not all included in routine CI; investigate reported regressions within the supported window and add targeted coverage when needed. Download or runner failures are blocked runtime evidence, not a compatibility pass.

Older editors cannot install the new extension release. Users must upgrade VS Code to receive it; this policy does not change the compatibility metadata of previously published Forma releases.

References:

- [Weekly stable release cadence](https://code.visualstudio.com/blogs/2026/03/13/how-VS-Code-Builds-with-AI)
- [VS Code 1.123 release and maintenance updates](https://code.visualstudio.com/updates/v1_123)
- [VS Code 1.124 release](https://code.visualstudio.com/updates/v1_124)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
