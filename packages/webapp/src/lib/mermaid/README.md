# Browser Mermaid adapter

This directory is a framework-independent browser boundary around Pele. Only flowchart, state, sequence, class, and entity relationship diagrams are registered. It replaces `beautiful-mermaid` and its transitive ELK layout runtime; the browser rendering capability remains owned by the WebApp rather than Core or editor integrations.

- `policy.ts` owns Forma's supported syntax, semantic model, and structural budgets. Pele's wider syntax support does not widen this product contract.
- `renderer.ts` registers the five diagram types, preserves authored direction, disables links and images, assigns per-worker/per-diagram SVG identifier namespaces, and applies bounded synchronous rendering. Empty diagrams, including empty class diagrams rejected by Pele's parser, retain the previous zero-size SVG behavior.
- `protocol.ts`, `worker-runtime.ts`, and `worker.ts` define the versioned module Worker boundary and output cap. Rendering stays off the main thread; no DOM or ELK compatibility shims are required.
- `controller.ts` provides a lazy, single-concurrency, abortable browser API. Abort and timeout terminate the active Worker.
- `scope.ts` accounts for aggregate work across multiple readers.

React, Marked, DOM sanitization, theme CSS variables, and reader markup remain in the dashboard feature adapter. The sanitizer removes all renderer-provided inline styles, links, images, scripts, and foreign HTML, then adds only fixed Pele theme variables. The known rectangle corner-radius declaration becomes a fixed SVG attribute; arbitrary CSS is never preserved. The final reader HTML still passes through DOMPurify. Generated Mermaid tokens use an object-identity allowlist for their own HTML renderer, so authored disclosure guards do not escape the source controls; author-supplied lookalike markup cannot use that path. The existing viewer continues to own zoom, pan, expansion, keyboard controls, accessible descriptions, and readable source fallback.

Run `pnpm --filter @choral-forma/webapp test:mermaid-worker-upgrade` after changing Pele. The fast Chrome gate exercises the production five-type module Worker, abort-and-recreate behavior, empty class diagrams, the SVG sanitization path, and main-thread scheduling. It complements unit, security, accessibility, RPC, and static WebApp browser checks. A renderer-only upgrade does not add rendering to Core's JavaScript-free HTML output or the native editor preview.
