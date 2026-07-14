# Extension dependency review

The bundled extension has one direct third-party JavaScript runtime dependency:

- `vscode-languageclient`: Microsoft's official VS Code Language Server Protocol client. It owns stdio protocol transport, document synchronization, provider registration, cancellation, and bounded restart integration for the shared `forma lsp` process. It stays inside the VS Code adapter and does not enter Forma Core, the CLI, or other editor extensions. Replacing or removing VS Code's LSP integration removes this dependency together with the adapter lifecycle.

The dependency bundles the Microsoft `vscode-jsonrpc`, `vscode-languageserver-protocol`, `vscode-languageserver-types`, and `vscode-languageserver-textdocument` packages under the same MIT license family. The remaining runtime uses Node.js and VS Code APIs, while shared Forma imports are type-only and erased by esbuild. The package also vendors only the selected Lucide SVG assets used by the Forma tree, with light and dark variants and the corresponding third-party notice.

Development dependencies stay inside `packages/vscode-extension`:

- `esbuild`: build-only bundler for the single CommonJS extension-host entrypoint; selected by the accepted architecture and removable if the repository adopts another extension bundler.
- `@types/vscode`, `@types/node`, `@types/mocha`: compile-time contracts only. The VS Code type version is pinned to the declared minimum compatibility floor.
- `@vscode/test-cli` and `@vscode/test-electron`: official VS Code Extension Host test path for the minimum and stable desktop versions; removable together if the project changes its official integration harness.
- `@vscode/vsce`: official VSIX packaging tool, used only in local validation and CI; Marketplace publishing remains disabled.
- `mocha`: test-only runner required by the official Extension Host test CLI.

The preview renderer deliberately uses escaped, dependency-free HTML generation instead of introducing a browser framework, Markdown runtime, or graph library. A later renderer project can replace that choice when requirements justify the added runtime cost.
