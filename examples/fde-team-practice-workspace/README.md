# FDE Synthetic Team Practice Workspace

This is a runnable, synthetic example of a team practice workspace. It shows two de-identified project indexes, a comparison evidence card, a proposal, human review, a limited pattern, a guideline/template, and a revalidation record.

The directories are team conventions. Forma only provides the explicitly configured `practice-content` group, Markdown schemas/templates/views, local references, guidelines, and checks. `portfolio-observation/` is not a built-in Forma portfolio.

`ENG-SYN-001` is a narrative scenario key only. This workspace contains no cross-workspace import or entry reference, original customer path, credential, synchronization, authorization, or automatic promotion.

## Run

Run from the repository root with the current checkout's Forma CLI:

```sh
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace config summary --sources --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace check --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace workspace health --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace inspect evidence-cards/acknowledgement-window-comparison.md --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace view render .forma/views/evidence-review.md --json
```

The evidence card must resolve two local project references:

- `projects/p-042`
- `projects/p-051`

They intentionally differ: P-042 is a staging asynchronous-queue case where the 120-second profile passes; P-051 is a production-like burst/retry case where the naive profile fails and the adjusted profile requires a 90-second window plus replay protection.

The negative result is retained as evidence. The practice conclusion is the diagnostic sequence and its conditions, not a universal threshold.
