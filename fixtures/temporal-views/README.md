# Temporal contract fixtures

This deliberately diagnostic workspace is isolated from the healthy manual validation corpus and the onboarding examples. Paths, collection names and fields are explicitly configured examples, not product defaults.

`config/gantt.md` and `config/calendar.md` select the same six exhibits. Separate, non-overlapping content-group schemas bind the same fields to date and datetime respectively. The hidden exhibit resolves as a reference but is excluded by the View query. The missing predecessor deliberately produces an unresolved-reference error; the reversed interval and self reference deliberately exercise View diagnostics.

The Core integration tests compare both projections with `packages/shared/src/fixtures/gantt-core.json` and `calendar-core.json`. Their independent feature assertions prevent regeneration from silently removing contract coverage. The fixture covers inclusive date ends, a midnight-exclusive timed interval, an equal-endpoint timed point shifted into the next workspace civil date, classification, progress (including zero and absence), a milestone, invalid and unscheduled entries, both edge statuses, and all dependency accounting buckets.

Expected render diagnostics are `entryRef.unresolved` for both Views, `view.calendarIntervalInvalid` for Calendar, and `view.ganttIntervalInvalid` plus `view.ganttDependencySelf` for Gantt. An operation can report failure because of the deliberate unresolved reference while still returning a complete projection. These diagnostics must not be repaired away or copied into the healthy validation corpus.

Regenerate each wire snapshot from the `render` member of `cargo run -q -p forma-cli -- view render config/<mode> --workspace fixtures/temporal-views --json`, where `<mode>` is `gantt` or `calendar`. Format the JSON and run `cargo test -p forma-core --test gantt_view --test calendar_view`; the intentional diagnostic means the render command exits nonzero even when it produces the expected snapshot.
