# FDE Synthetic Team Practice Workspace

This is a runnable, synthetic example of a team practice workspace. It shows two de-identified project indexes, a comparison evidence card, a proposal, human review, a limited pattern, a guideline/template, and a revalidation record.

The directories are team conventions. Each stable record type has its own configured Forma content group, schema, create template, and partition guidance; Forma does not provide customer, project, evidence, pattern, or portfolio domain types. Read `guidelines/practice-partition-contracts.md` before routing a record. `portfolio-observation/` is not a built-in Forma portfolio.

`ENG-SYN-001` is a narrative scenario key only. This workspace contains no cross-workspace import or entry reference, original customer path, credential, synchronization, authorization, or automatic promotion.

## Run

Run from the repository root with the current checkout's Forma CLI:

```sh
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace config summary --sources --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace check --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace workspace health --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace workspace explain projects/p-042.md --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace inspect evidence-cards/acknowledgement-window-comparison.md --json
cargo run -q -p forma-cli -- --workspace examples/fde-team-practice-workspace view render .forma/views/evidence-review.md --json
```

The evidence card must resolve two local project references:

- `projects/p-042`
- `projects/p-051`

They intentionally differ: P-042 is a staging asynchronous-queue case where the 120-second profile passes; P-051 is a production-like burst/retry case where the naive profile fails and the adjusted profile requires a 90-second window plus replay protection.

The negative result is retained as evidence. The practice conclusion is the diagnostic sequence and its conditions, not a universal threshold.

## Agent workflow

1. Read the partition contract and distillation guideline.
2. Keep customer/project/source indexes separate from evidence cards and verification results.
3. Draft a proposal only from workspace-local evidence, then stop for human review.
4. Keep the accepted pattern, guideline, reusable template, and revalidation as separate records.

The workspace demonstrates team conventions and review boundaries; it does not provide cross-workspace imports, synchronization, authorization, automatic promotion, RBAC, or a built-in portfolio.
