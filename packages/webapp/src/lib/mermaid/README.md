# Browser Mermaid adapter

This directory is a framework-independent browser boundary around `beautiful-mermaid`.

- `policy.ts` owns Forma's supported syntax, semantic model, and structural budgets.
- `protocol.ts`, `worker-runtime.ts`, and `worker.ts` define the versioned Worker boundary and output cap. Before dynamically importing the synchronous renderer, the dedicated Worker installs Worker-local `document` and writable `self` shims so `elkjs` selects its in-process FakeWorker and `beautiful-mermaid` can restore its environment instead of mistaking Forma's host Worker for an ELK layout worker.
- `controller.ts` provides a lazy, single-concurrency, abortable browser API. Abort and timeout terminate the active Worker.
- `scope.ts` accounts for aggregate work across multiple readers.

React, Marked, DOM sanitization, theme CSS variables, and reader markup remain in the dashboard feature adapter. A future consumer such as Choral Flows can extract or reuse this boundary only after matching its product policy and security requirements; this directory is not a published package.

Run `pnpm --filter @choral-forma/webapp test:mermaid-worker-upgrade` after changing `beautiful-mermaid` or its transitive layout dependencies. The fast Chrome gate exercises the real module Worker, abort-and-recreate behavior, an admitted render, the production SVG sanitization path, and main-thread scheduling. It complements the complete unit, security, accessibility, and browser checks.
