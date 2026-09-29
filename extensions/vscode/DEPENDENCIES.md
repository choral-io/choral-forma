# Extension dependency review

The extension-host bundle uses one direct third-party JavaScript runtime dependency:

- `vscode-languageclient`: Microsoft's official VS Code Language Server Protocol client. It owns stdio protocol transport, document synchronization, provider registration, cancellation, and bounded restart integration for the shared `forma lsp` process. It stays inside the VS Code adapter and does not enter Forma Core, the CLI, or other editor extensions. Replacing or removing VS Code's LSP integration removes this dependency together with the adapter lifecycle.

The dependency bundles the Microsoft `vscode-jsonrpc`, `vscode-languageserver-protocol`, `vscode-languageserver-types`, and `vscode-languageserver-textdocument` packages under the same MIT license family. The remaining extension-host runtime uses Node.js and VS Code APIs. Browser preview code is bundled separately and does not import the editor API. The package also vendors only the selected Lucide SVG assets used by the Forma tree, with light and dark variants and the corresponding third-party notice.

Development dependencies stay inside `extensions/vscode`:

- `esbuild`: build-only bundler for the CommonJS extension-host and browser preview entrypoints; selected by the accepted architecture and removable if the repository adopts another extension bundler.
- `@types/vscode`, `@types/node`, `@types/mocha`, `@types/react`: compile-time contracts only. The VS Code types use the minimum supported API series, or the closest earlier published series when declarations are unavailable; they never target a newer API than the declared editor floor. See [API compatibility](./API_COMPATIBILITY.md).
- `@vscode/test-cli` and `@vscode/test-electron`: official VS Code Extension Host test path for the minimum and stable desktop versions; removable together if the project changes its official integration harness.
- `@vscode/vsce`: official VSIX packaging tool, used for local validation and CI packaging. Marketplace publication remains a separately authorized maintainer operation.
- `mocha`: test-only runner required by the official Extension Host test CLI.

The Markdown renderer emits escaped HTML and complete static fallbacks. The browser preview bundle adds the framework-independent shared Graph renderer and the shared `@choral-forma/temporal-view` Calendar/Gantt renderer. As approved on 2026-09-29, the latter reuses React, React DOM (including Scheduler), and selected Lucide React icons already used by the WebApp. They are bundled into the preview script rather than loaded from a CDN; removing the interactive temporal previews removes this runtime dependency. The extension's direct React development dependency supports adapter tests.

`packages/temporal-view` owns Tailwind and daisyUI as build-time dependencies. Only the generated, locally scoped CSS ships with the preview, using editor theme tokens inside Shadow DOM. No specialized scheduling library, router, WebApp shell, or new dependency version is introduced. The shared date and geometry helpers remain independent of React. See [Third-Party Notices](./THIRD_PARTY_NOTICES.md) for the bundled runtime and CSS licenses.
