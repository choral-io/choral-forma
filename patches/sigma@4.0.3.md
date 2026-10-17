# Sigma 4.0.3 label-picking compatibility patch

## Purpose

Verified against the patched Sigma 4.0.3 production WebApp on 2026-10-17. The patch prevents node-label glyph rendering from running against the picking framebuffer. The original failure was reproduced with Sigma 4.0.0 in a real VS Code Markdown WebView: drawing labels produced `GL_INVALID_OPERATION: glDrawArraysInstanced: Active draw buffers with missing fragment shader outputs`, and `gl.getError()` returned `1282`.

## Patch Scope

[sigma@4.0.3.patch](./sigma@4.0.3.patch) updates the published `dist/sigma.esm.js`, `dist/sigma.cjs.dev.js`, and `dist/sigma.cjs.prod.js` bundles. The node-label call to `renderWebGLLabels` receives a copy of the render parameters with `pickingFrameBuffer: null`. Glyph shaders do not provide a useful picking output; node-label backgrounds retain their separate hit-testing pass. Node and edge picking, label appearance, application graph semantics, and layout algorithms are otherwise unchanged.

The exact version is registered in [pnpm-workspace.yaml](../pnpm-workspace.yaml), with its patch hash recorded in [pnpm-lock.yaml](../pnpm-lock.yaml). Keep the patch file, registration, and lockfile entry together when updating the dependency.

## Verification

Run from the repository root:

```sh
mise exec -- pnpm --filter @choral-forma/graph-view check
mise exec -- pnpm --filter @choral-forma/graph-view test
mise exec -- pnpm --filter @choral-forma/graph-view lint
mise exec -- pnpm --filter @choral-forma/webapp build
mise exec -- pnpm --filter ./extensions/vscode build
```

The [runtime tests](../packages/graph-view/src/runtime.test.ts) cover selection, theme updates, arrow direction, camera behavior, and resource cleanup through a mocked Sigma renderer. They do not reproduce or detect the actual GPU failure. Builds verify bundling and types, not browser rendering.

For runtime acceptance, serve the production WebApp through the Forma backend and open a configured graph in the native VS Code Markdown preview. Use an isolated test workspace with valid references. Verify visible nodes and arrows, hover labels, selection and linked-node highlighting, theme changes, expansion, reset, and keyboard navigation. Check that the stage canvas has a live WebGL 2 context, `gl.getError()` returns `0` after initial rendering and repeated interactions, and no label-picking errors appear in the browser or GPU logs.

Patched 4.0.0 passed both actual hosts, including WebView cold start. After rebasing the patch to 4.0.3 and refreshing dependencies, type checks, 48 graph-view tests, both builds, production WebApp rendering, and a native VS Code 1.141.2 WebView cold start passed on 2026-10-17. Both hosts returned `gl.getError() === 0`; the WebView recorded first-render and synchronous-layout-settled marks. The editor host also emitted an intermittent built-in preview `Found unexpected null` exception outside the graph code; the graph remained visible and interactive.

## Upstream And Removal

As inspected on 2026-10-16, Sigma 4.0.3 and upstream `main` at commit `673b8217d88bc52715ad2ec422840fd74bb9be0d` still passed the original parameters from [Sigma's render loop](https://github.com/jacomyal/sigma.js/blob/673b8217d88bc52715ad2ec422840fd74bb9be0d/packages/sigma/src/sigma.ts#L1255) through to [the label program](https://github.com/jacomyal/sigma.js/blob/673b8217d88bc52715ad2ec422840fd74bb9be0d/packages/sigma/src/core/label-renderer.ts#L390). No upstream issue or PR has been submitted for this patch. Unpatched 4.0.3 has not yet been independently reproduced at runtime; source inspection alone is not that evidence.

Before contributing upstream, reproduce the failure with an unpatched current release, change the upstream TypeScript source, and add a real browser regression that checks GPU errors and label hit testing. The generated-bundle patch is a local compatibility measure, not an upstream-ready change.

Remove the patch file and its registration, regenerate the lockfile, and verify a clean frozen-lockfile installation only after an installed unpatched replacement release passes the runtime checks in both hosts. A merged PR or successful build alone is insufficient.

## Known Limitations

This patch is specific to node-label glyph rendering. It does not certify edge-label rendering, all picking configurations, or all browsers and GPU drivers. WebApp and native WebView acceptance on 4.0.3 used a small configured graph. The CJS bundles receive the same fix but were not independently exercised through both public CJS entry points. Windows, Remote Extension Host, and large-graph performance remain unverified.
