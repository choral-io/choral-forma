# Choral Forma Starter Kit

This workspace is a small, user-facing starter example for Choral Forma. It is
designed to be opened in the read-only WebApp as a guide, setup reference, and
feature demonstration.

It uses ordinary Markdown files plus explicit Forma configuration under
`.forma/`. The workspace intentionally uses `spaces.yml`; legacy collection
configuration is not part of the public example.

The example includes:

- `notes/`: guide pages that explain the product surfaces;
- `todos/`: lightweight onboarding tasks for the kanban view;
- `users/`: example people referenced by tasks and pages;
- `assets/markdown-hero.png`: an image used by the reader examples;
- `.forma/views/`: saved table, list, kanban, and graph views.

Serve it locally with:

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

Refresh the committed summary index after changing example content:

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit index rebuild
```
