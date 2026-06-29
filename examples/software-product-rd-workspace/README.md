# Software Product R&D Workspace

This example shows a small software product team using Forma to keep research, product direction, architecture, design, delivery tasks, validation, releases, metrics, and experiments in ordinary Markdown.

The sample product is `Atlas Notes`, a fictional team workspace for organizing product research and release planning. It is intentionally generic: the structure should be useful for software product teams without copying Choral Forma's own project history.

Start here:

- `product/atlas-notes.md` for product direction.
- `research/pilot-planning-friction.md` for user evidence behind the release.
- `releases/planning-beta.md` for release scope.
- `tasks/` for delivery work and board status.
- `guidelines/` for how humans and Agents should maintain the workspace.

Verify the workspace with:

```sh
forma --workspace examples/software-product-rd-workspace config inspect --json
forma --workspace examples/software-product-rd-workspace check --json
forma --workspace examples/software-product-rd-workspace workspace health --json
```

This template is not a full project-management system. It keeps the first copyable version small so teams can add spaces and fields only after they have repeated evidence that they need them.
