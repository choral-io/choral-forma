---
scope: member
type: handoff
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - workspace
    - handoff
    - forma
    - graph
    - vscode
    - wsl
    - remote
    - validation
---

# WSL 2 Remote Graph Validation Handoff

## Purpose

在一台资源充足的 Windows 主机上，通过 VS Code Remote - WSL 和 WSL 2 完成当前 Graph 候选的真实 Remote Extension Host 功能验收，并采集剩余的视觉、交互和资源证据。

本轮验收绑定以下精确候选，不得用旧 VSIX、旧二进制或 2026-08-11 的 Podman/Remote SSH 结果替代：

- repository: `choral-io/choral-forma`
- commit: `3804d589eaac85f835f513772115012cce05bbcd`
- extension identity: `choral-io.forma@0.1.30`
- extension kind: `workspace`

开始前阅读：

- [Validate Shared Graph View Cross-Host Parity](../../../tasks/validate-shared-graph-view-cross-host-parity.md)
- [Shared Graph View Cross-Host Parity Validation — 2026-08-11](../../../discovery/shared-graph-view-cross-host-parity-validation-2026-08-11.md)
- [Forma Performance Engineering](../../../architecture/forma-performance-engineering.md)
- [VS Code Remote development in WSL](https://code.visualstudio.com/docs/remote/wsl-tutorial)
- [VS Code remote extension architecture](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [Microsoft WSL installation](https://learn.microsoft.com/windows/wsl/install)
- [Microsoft WSL filesystem guidance](https://learn.microsoft.com/windows/wsl/filesystems)

## Acceptance Boundary

WSL 2 is acceptable for the task's generic **Remote validation** gate because:

- VS Code Server and the Forma workspace extension run inside the Linux WSL Remote Extension Host;
- the workspace, candidate Linux `forma` binary, extension storage, filesystem watchers, LSP, CLI calls, and Graph projection are exercised on the Remote side;
- the native Markdown Preview and its webview remain in the Windows VS Code client, preserving the same UI/Remote split that a workspace extension must support.

If this WSL run passes, it may close the functional Remote Host portion after the evidence is reviewed in the main task. It does **not** prove:

- Remote-SSH connection, tunneling, reconnection, latency, or packet-loss behavior;
- cross-machine filesystem or network performance;
- a production Linux server resource baseline;
- WebApp Worker performance, because VS Code Graph Preview intentionally uses the synchronous layout policy;
- final WebApp/VS Code coordinate equality, which is an explicit Host-adapter difference.

Keep the earlier low-resource SSH result as boundary evidence. Do not relabel a WSL result as `Remote SSH passed`.

## Host Requirements

Preferred host:

- Windows 11 x64 with current updates;
- current Store-delivered WSL and an Ubuntu 24.04 LTS WSL 2 distribution;
- current stable VS Code, at least `1.110.0`;
- at least 4 logical CPUs and 8 GiB host RAM available to WSL during the run;
- at least 20 GiB free Linux filesystem space;
- hardware acceleration left at its normal VS Code setting.

The minimum useful retry is 2 vCPU and 4 GiB available memory. Do not use a 1 vCPU / approximately 1 GiB environment for Graph Preview acceptance. `systemd` is not required for this validation.

Store the repository under the WSL Linux filesystem, for example `~/src/choral-forma`. Do not build under `/mnt/c/...`; cross-filesystem I/O would distort install, watcher, render, and resource observations.

If the host globally constrains WSL below the preferred resources, update `%UserProfile%\\.wslconfig` before the run, then execute `wsl --shutdown`. Example only—do not reduce a machine that already has a better allocation:

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
```

## Phase 1 — Windows And WSL Preflight

Run in PowerShell:

```powershell
wsl --update
wsl --version
wsl --status
wsl --list --verbose
code --version
Get-CimInstance Win32_OperatingSystem |
    Select-Object Caption, Version, OSArchitecture, TotalVisibleMemorySize, FreePhysicalMemory
Get-CimInstance Win32_ComputerSystem |
    Select-Object Manufacturer, Model, NumberOfLogicalProcessors, TotalPhysicalMemory
```

Expected:

- the target distribution reports `VERSION 2`;
- the Windows and VS Code versions are recorded;
- the host meets the preferred resources, or any shortfall is called out before interpreting timings.

Install the Microsoft **WSL** extension in the Windows-local VS Code Extensions view. Do not install a Linux GUI build of VS Code inside WSL.

Run inside the target WSL distribution:

```bash
uname -a
uname -m
cat /etc/os-release
nproc
free -h
df -h "$HOME"
getconf GNU_LIBC_VERSION
```

Record all output in `target/validation/wsl2/evidence/host.txt` after the repository has been prepared.

## Phase 2 — Prepare The Exact Candidate

Install ordinary build prerequisites inside WSL if they are missing:

```bash
sudo apt-get update
sudo apt-get install -y build-essential curl git jq pkg-config libssl-dev sysstat
```

Clone and detach at the exact candidate:

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/choral-io/choral-forma.git
cd choral-forma
git fetch origin
git checkout --detach 3804d589eaac85f835f513772115012cce05bbcd
test "$(git rev-parse HEAD)" = "3804d589eaac85f835f513772115012cce05bbcd"
test -z "$(git status --porcelain)"
```

Install the project-declared toolchain. The exact sources of truth are `.node-version`, `package.json#packageManager`, `package.json#engines`, and `rust-toolchain.toml`; `mise` is the convenient installer, not a substitute for those declarations.

```bash
command -v mise >/dev/null || curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
mise install
rustup target add wasm32-wasip1
pnpm install --frozen-lockfile
```

Run the complete candidate gate before packaging:

```bash
mise run check
git status --short
```

Expected: every check passes and the worktree remains clean. If dependency download or registry access fails, record the exact network error; do not classify it as a Graph defect.

Build the Linux CLI and candidate VSIX from the same SHA:

```bash
mkdir -p target/validation/wsl2/evidence
cargo build --release --locked --bin forma
VSIX_OUT="$PWD/target/validation/wsl2/forma-0.1.30-3804d589eaac.vsix" \
    pnpm --filter forma package:vsix
sha256sum \
    target/release/forma \
    target/validation/wsl2/forma-0.1.30-3804d589eaac.vsix \
    > target/validation/wsl2/evidence/checksums.txt
git rev-parse HEAD > target/validation/wsl2/evidence/candidate.txt
git status --porcelain >> target/validation/wsl2/evidence/candidate.txt
```

Do not accept the extension's managed-download prompt for this run. The released managed binary may have the same package version but is not the candidate built from `3804d58`. Configure the WSL Remote setting `forma.path` to the candidate's absolute Linux path instead.

## Phase 3 — Generate Remote Graph Fixtures

The committed adapter tests already share deterministic empty/small/medium/large projections. The following temporary real workspaces exercise the same size classes through Core, the workspace extension, native Markdown Preview, and the WSL filesystem.

Run from the repository root inside WSL:

```bash
node --input-type=module <<'NODE'
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "target/validation/wsl2/fixtures");
const profiles = { empty: 0, small: 25, medium: 500, large: 5000 };
const stages = ["doing", "done", "#dc2626", true, 7, undefined];

await rm(root, { recursive: true, force: true });
for (const [profile, size] of Object.entries(profiles)) {
    const workspace = join(root, profile);
    await mkdir(join(workspace, ".forma/spaces"), { recursive: true });
    await mkdir(join(workspace, ".forma/views"), { recursive: true });
    await mkdir(join(workspace, "notes"), { recursive: true });
    await writeFile(
        join(workspace, ".forma.md"),
        `---\nschemaVersion: 1\nworkspace:\n  name: WSL Graph ${profile}\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n---\n`,
    );
    await writeFile(
        join(workspace, ".forma/spaces/index.md"),
        `---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\nprojection: contentGroups\ntitle: Spaces\nmode: primary\ndisplay:\n  color: "#64748B"\n---\n`,
    );
    await writeFile(
        join(workspace, ".forma/spaces/notes.md"),
        `---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - "notes/**/*.md"\nschema:\n  type: object\n  fields:\n    title:\n      type: string\ndisplay:\n  color: "#4F7CAC"\n---\n`,
    );
    await writeFile(
        join(workspace, ".forma/views/graph-by-field.md"),
        `---\nschemaVersion: 1\nkind: view\ntitle: Graph By Field\nmode: graph\nsource:\n  type: pages\n  taxonomy:\n    spaces: [notes]\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        field: fields.stage\n  edges:\n    - source: body\n      intent: link\n      label: links to\n---\n\n# Graph By Field\n\n<!-- forma:content -->\n`,
    );
    await writeFile(
        join(workspace, ".forma/views/graph-by-taxonomy.md"),
        `---\nschemaVersion: 1\nkind: view\ntitle: Graph By Taxonomy\nmode: graph\nsource:\n  type: pages\n  taxonomy:\n    spaces: [notes]\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        taxonomy: spaces\n  edges:\n    - source: body\n      intent: link\n      label: links to\n---\n\n# Graph By Taxonomy\n\n<!-- forma:content -->\n`,
    );

    const batchSize = 250;
    for (let offset = 0; offset < size; offset += batchSize) {
        await Promise.all(
            Array.from({ length: Math.min(batchSize, size - offset) }, async (_, batchIndex) => {
                const index = offset + batchIndex;
                const slug = `note-${String(index).padStart(5, "0")}`;
                const nextIndex = index === 0 ? 1 : index === 1 ? 0 : index === size - 1 ? 2 : index + 1;
                const next = `note-${String(nextIndex).padStart(5, "0")}`;
                const stage = stages[index % stages.length];
                const title =
                    index === 0
                        ? "A deliberately long WSL Graph label that must use the shared truncation policy"
                        : `Node ${index}`;
                const stageLine = stage === undefined ? "" : `stage: ${JSON.stringify(stage)}\n`;
                await writeFile(
                    join(workspace, "notes", `${slug}.md`),
                    `---\ntitle: ${JSON.stringify(title)}\n${stageLine}---\n\n# ${title}\n\nNext: [[notes/${next}]].\n`,
                );
            }),
        );
    }
}
NODE
```

The first two nodes form reciprocal links, the first title is deliberately long, and the field values cover palette strings, explicit hex, boolean, number, and `Unclassified` behavior. Unresolved-target omission remains covered by the committed shared semantic fixture; it is intentionally absent here so every real Remote workspace can pass `forma check` before visual validation.

Verify every temporary workspace through the exact candidate CLI:

```bash
for profile in empty small medium large; do
    workspace="target/validation/wsl2/fixtures/$profile"
    ./target/release/forma --workspace "$workspace" check --json \
        > "target/validation/wsl2/evidence/$profile-check.json"
    ./target/release/forma --workspace "$workspace" workspace health --json \
        > "target/validation/wsl2/evidence/$profile-health.json"
    ./target/release/forma --workspace "$workspace" view render .forma/views/graph-by-field.md --json \
        > "target/validation/wsl2/evidence/$profile-field-render.json"
    ./target/release/forma --workspace "$workspace" view render .forma/views/graph-by-taxonomy.md --json \
        > "target/validation/wsl2/evidence/$profile-taxonomy-render.json"
done
```

Expected:

- all operations report zero errors;
- render node counts are `0`, `25`, `500`, and `5000`;
- field legends include `doing`, `done`, normalized `#DC2626`, `true`, `7`, and `Unclassified` when represented by the fixture;
- taxonomy render data preserves `taxonomy: spaces` and does not replace it with `field` provenance.

## Phase 4 — Start The Real WSL Remote Host

From the repository root inside WSL, run:

```bash
code .
```

In the resulting VS Code window:

1. Confirm the lower-left Remote indicator says `WSL: <distribution>`.
2. If the Welcome screen appears, click its upper-right close button. Do not start a sign-in or Settings Sync flow.
3. Trust this cloned repository when prompted.
4. Run **Extensions: Install from VSIX...** and select `target/validation/wsl2/forma-0.1.30-3804d589eaac.vsix` from the WSL filesystem.
5. Confirm the extension appears under `WSL: <distribution> – Installed`, not only under Local Installed.
6. Open **Preferences: Open Remote Settings (JSON)** and set:

```json
{
    "extensions.autoUpdate": false,
    "forma.path": "/home/<user>/src/choral-forma/target/release/forma"
}
```

7. Replace `<user>` with the actual WSL user and keep the value an absolute Linux path.
8. Run **Developer: Reload Window**.
9. Confirm the Forma status reaches `Forma: Ready` and **Forma: Open Output** shows the configured candidate path without material errors.
10. Run **Developer: Show Running Extensions** and record that `choral-io.forma` runs in the WSL Remote Extension Host.

Do not accept a matching CLI download prompt. If the configured `forma.path` is ignored, stop and capture the Forma output rather than validating against an unknown binary.

## Phase 5 — Functional And Visual Matrix

### A. Current Repository Workspace

From the Forma Explorer panel, open **Workspace Graph** in native Markdown Preview and verify:

- Graph canvas renders Page labels rather than remaining blank for 30 seconds;
- the `spaces` taxonomy legend renders and uses the configured taxonomy/Term colors;
- selecting a node shows its Page title, path, and relationship count;
- one-hop neighbors and edges are emphasized;
- `Enter` or double-click opens the selected source Page;
- `Escape` clears selection or exits expanded mode as appropriate;
- expand, exit expanded mode, and reopen work;
- closing the Preview disposes it; reopening produces one working Graph without duplicate controls;
- **Developer: Reload Window** returns to `Forma: Ready` and the Graph can be opened again.

Capture at least one screenshot showing the WSL Remote indicator, Forma Ready status, canvas, and legend.

### B. Empty, Small, Medium, And Large Fixtures

Use **File: Open Folder...** in the WSL window and open these Linux folders one at a time:

- `target/validation/wsl2/fixtures/empty`
- `target/validation/wsl2/fixtures/small`
- `target/validation/wsl2/fixtures/medium`
- `target/validation/wsl2/fixtures/large`

For each folder:

1. Confirm `Forma: Ready`.
2. Open **Graph By Field** from the Forma Explorer.
3. Record time until the first meaningful canvas is visible and time until layout movement settles.
4. Select a node, inspect the summary, reset with `F`, expand, exit, and reopen the Preview.
5. Confirm empty state wording for `empty`.
6. Confirm the expected field legend and neutral `Unclassified` nodes for `small` and larger fixtures.
7. Confirm the 5,000-node canvas appears and remains responsive enough to select, reset, expand, and close.
8. Open **Graph By Taxonomy** and confirm the original taxonomy path still renders.

The 5,000-node VS Code path intentionally uses deterministic seed coordinates with zero synchronous ForceAtlas2 iterations. A fast settle is not evidence that Worker layout ran.

### C. Theme And Reduced-Motion Sessions

On the `small` fixture, repeat the Graph check with:

- a built-in light theme;
- a built-in dark theme;
- the built-in High Contrast theme;
- Windows **Settings > Accessibility > Visual effects > Animation effects: Off**, followed by a VS Code window reload.

Verify Graph labels, focus outline, selected-node summary, legend, edges, and controls remain readable. In reduced motion, reset and selection-follow behavior must avoid animated camera movement. Record theme names and restore the host's original Animation effects preference afterward.

## Phase 6 — Timing And Resource Evidence

These measurements are evidence, not a new universal budget. WSL timings are comparable only within this recorded host configuration and must not be merged with WebApp Worker timings.

For each `small`, `medium`, and `large` Graph By Field Preview, record:

- projection JSON byte size from the corresponding `*-field-render.json` file;
- first meaningful canvas time;
- layout settle time;
- longest main-thread task from the Markdown Preview webview Performance trace;
- node-selection response time;
- reset response time;
- whether interaction ever freezes for more than one second.

Use **Developer: Open Webview Developer Tools**, select the relevant Markdown Preview target, and capture a Performance trace around Preview open and one interaction. Keep raw traces and screenshots under `target/validation/wsl2/evidence/`; do not commit them by default.

The Core view-render budgets remain reference points:

- 1,000-entry dashboard or view p95: no more than 150 ms;
- 5,000-entry dashboard or view p95: no more than 750 ms.

Measure the exact candidate CLI separately if needed; do not use browser wall-clock timing as the Core operation p95.

For idle CPU, leave the settled large Graph untouched for 30 seconds and run in the WSL terminal:

```bash
pidstat -u -r -p ALL 1 30 | tee target/validation/wsl2/evidence/idle-large.txt
```

Also capture **Developer: Open Process Explorer** in VS Code. WSL process sampling covers the VS Code Server and Remote Extension Host; the Windows Process Explorer is needed for the local renderer/webview side.

For disposal retention:

1. Record Process Explorer and WSL process RSS with the large Preview open.
2. Close the Preview and wait 5 seconds.
3. Reopen and close the same Preview 10 times, always waiting for the canvas before closing.
4. Wait 30 seconds after the final close.
5. Record the same process rows again.

Report the before/after values and trend. Do not invent a pass threshold; flag monotonic growth, surviving duplicate webviews/controllers, continuous settled CPU, crashes, or extension-host restarts for investigation.

## Result Template

Copy this section into a new local result note or the main task response. Do not update the canonical task or shared 2026-08-11 validation record until the evidence has been reviewed.

```md
## WSL 2 Remote Result

- Candidate: `3804d589eaac85f835f513772115012cce05bbcd`
- Worktree clean: yes/no
- VSIX SHA-256:
- CLI SHA-256:
- Windows version/architecture:
- VS Code version:
- WSL version:
- Distribution/kernel/glibc:
- Allocated CPU/RAM/swap:
- Repository location is Linux filesystem: yes/no
- Forma extension location: WSL Remote Extension Host / other
- Resolved `forma.path`:
- `mise run check`: pass/fail
- CLI fixture checks: pass/fail
- Current workspace taxonomy Graph: pass/fail
- Field colors (`doing`, `done`, `#DC2626`, `true`, `7`, `Unclassified`): pass/fail
- Empty/small/medium/large: pass/fail per fixture
- Light/dark/high-contrast/reduced-motion: pass/fail per session
- Selection/navigation/reset/expand/reload/disposal: pass/fail per action
- First meaningful canvas and settle timings:
- Longest main-thread tasks and interaction observations:
- Idle CPU observation:
- Retained-memory before/after 10 disposal cycles:
- Material Forma/Extension Host/Webview errors:
- Evidence file paths:
- WSL Remote functional conclusion: pass/fail
- Explicitly not claimed: Remote-SSH transport or cross-machine performance
```

## Stop Conditions

Stop and preserve evidence instead of retrying blindly when:

- `git rev-parse HEAD` is not the exact candidate or the worktree is dirty before validation;
- the installed VSIX identity is wrong or the extension runs only on the Local host;
- Forma resolves a downloaded/released binary instead of the candidate `target/release/forma`;
- the WSL host has less than 2 vCPU or 4 GiB available memory;
- native Preview remains blank for 30 seconds;
- the Remote Extension Host crashes or repeatedly restarts;
- filesystem watcher, webview, Graph, LSP, or CLI errors recur after one window reload;
- the 5,000-node fixture causes sustained swapping or makes the VS Code window unusable.

Record whether the failure is candidate behavior, WSL/VS Code infrastructure, missing dependencies, or insufficient host resources. Do not downgrade checks or change Graph layout policy to make the run pass.

## Cleanup

After copying the evidence needed for review:

1. Close every VS Code window created for validation as soon as it is no longer needed.
2. Use **File: Close Remote Connection** if a validation window remains attached.
3. Restore Windows Animation effects and any temporary theme.
4. Remove the validation-only VSIX installation from the WSL host if the machine should return to its prior state.
5. Keep `target/validation/wsl2/evidence/` only until the result has been handed back; it is ignored local evidence, not a commit candidate.
6. From PowerShell, run `wsl --shutdown` when no other WSL workload needs to remain active.

The repository clone may be retained for follow-up. Do not delete any pre-existing WSL distribution, VS Code profile, extension, project, or user container as part of cleanup.
