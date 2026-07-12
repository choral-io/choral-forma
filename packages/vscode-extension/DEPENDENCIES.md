# Extension dependency review

Alpha 15 adds no third-party JavaScript runtime dependency to the bundled extension. The runtime uses Node.js and VS Code APIs, while shared Forma imports are type-only and erased by esbuild. The package vendors only the selected Lucide SVG assets used by the Forma tree, with light and dark variants and the corresponding third-party notice.

Development dependencies stay inside `packages/vscode-extension`:

- `esbuild`: build-only bundler for the single CommonJS extension-host entrypoint; selected by the accepted architecture and removable if the repository adopts another extension bundler.
- `@types/vscode`, `@types/node`, `@types/mocha`: compile-time contracts only. The VS Code type version is pinned to the declared minimum compatibility floor.
- `@vscode/test-cli` and `@vscode/test-electron`: official VS Code Extension Host test path for the minimum and stable desktop versions; removable together if the project changes its official integration harness.
- `@vscode/vsce`: official VSIX packaging tool, used only in local validation and CI; Marketplace publishing remains disabled.
- `mocha`: test-only runner required by the official Extension Host test CLI.

The preview renderer deliberately uses escaped, dependency-free HTML generation instead of introducing a browser framework, Markdown runtime, or graph library. A later renderer project can replace that choice when requirements justify the added runtime cost.
