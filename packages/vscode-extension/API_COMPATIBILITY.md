# VS Code API compatibility

Alpha 13 declares `engines.vscode: ^1.110.0`.

The extension uses stable APIs available by VS Code 1.110: workspace folders and filesystem watchers, Workspace Trust (`workspace.isTrusted` and `onDidGrantWorkspaceTrust`), status bars, output channels, Markdown definition/hover/document-link providers, CodeLens, diagnostics, WebView panels, theme tokens, and `extensionKind: ["workspace"]` manifest placement.

No API introduced after 1.110 is required. The runtime bundle remains restricted to Node 18-compatible syntax, a conservative subset of the declared extension-host floor. Version 1.110 is an intentional product support baseline: Alpha 13 does not carry compatibility work for earlier VS Code releases. The release validates both 1.110 and current stable when the environment permits.

References:

- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Workspace Trust Extension Guide](https://code.visualstudio.com/api/extension-guides/workspace-trust)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code 1.110 release notes](https://code.visualstudio.com/updates/v1_110)
