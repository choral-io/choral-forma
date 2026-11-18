import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describeBrowserEvidenceError, writeBrowserEvidence } from "./markdown-browser-evidence.mjs";
import { markdownBrowserPhases, parseMarkdownBrowserPhase } from "./markdown-browser-protocol.mjs";
import { markdownBrowserScenarios } from "./markdown-browser-scenarios.mjs";
import { markdownMermaidGeometry } from "./markdown-mermaid-geometry.mjs";
import { observeReader } from "./reader-browser-diagnostics.mjs";
import { readerBrowserChecks, readerBrowserRegressionSource } from "./reader-browser-regressions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);
const binary = join(root, "target", "debug", process.platform === "win32" ? "forma.exe" : "forma");
await mkdir(join(root, "packages/webapp/.tmp"), { recursive: true });
const artifacts = await mkdtemp(join(root, "packages/webapp/.tmp/markdown-browser-"));
const temporary = await mkdtemp(join(await realpath(tmpdir()), "forma-markdown-browser-"));
const workspace = join(temporary, "workspace");
const site = join(temporary, "site");
let calloutBoundaries;
const session = `forma-md-${process.pid}`;
const cli = process.env.PLAYWRIGHT_CLI ?? "playwright-cli";
const abort = new AbortController();
let interrupted;
let testResult;
let cleanupPromise;
const backends = [];
const staticServers = [];
let browserStarted = false;
let backendLog = "";
const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
};

async function command(file, args, timeout = 60_000, cleaning = false, label = "command") {
    let active;
    let watchdog;
    try {
        if (!cleaning) abort.signal.throwIfAborted();
        const running = execute(file, args, {
            cwd: root,
            timeout,
            maxBuffer: 8 * 1024 * 1024,
            signal: cleaning ? undefined : abort.signal,
            killSignal: "SIGTERM",
        });
        active = running.child;
        watchdog = setTimeout(() => {
            if (active?.pid && active.exitCode === null && active.signalCode === null) active.kill("SIGKILL");
        }, timeout + 5000);
        const result = await running;
        const output = result.stdout + result.stderr;
        await writeFile(join(artifacts, `${label}.log`), output);
        return output;
    } catch (error) {
        await writeFile(
            join(artifacts, `${label}.log`),
            `${error.stdout ?? ""}${error.stderr ?? ""}\n${describeBrowserEvidenceError(error)}`,
        );
        throw error;
    } finally {
        // In particular, let playwright-cli forward SIGTERM to its starting daemon.
        try {
            await stop(active);
        } finally {
            clearTimeout(watchdog);
        }
    }
}
async function browserCommand(...args) {
    const output = await command(
        cli,
        [`-s=${session}`, ...args],
        args[0] === "close" ? 10_000 : 120_000,
        args[0] === "close",
        args[0],
    );
    if (/^### Error(?:\r?\n|$)/mu.test(output)) throw new Error(output);
    return output;
}
async function stop(child) {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    const closed = once(child, "close");
    child.kill("SIGTERM");
    const kill = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
        await closed;
    } finally {
        clearTimeout(kill);
    }
}
for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
]) {
    process.on(signal, () => {
        if (interrupted) return;
        interrupted = signal;
        process.exitCode = code;
        abort.abort(new Error(`Interrupted by ${signal}`));
    });
}

try {
    console.log(`Artifacts: ${artifacts}`);
    await writeFile(join(artifacts, "run.json"), JSON.stringify({ session, temporary, pid: process.pid }));
    calloutBoundaries = JSON.parse(
        await readFile(join(root, "fixtures/forma-validation/cases/markdown-callout-boundaries.json"), "utf8"),
    );
    const readingCases = JSON.parse(
        await readFile(join(root, "fixtures/forma-validation/cases/markdown-reading-p1.json"), "utf8"),
    );
    const disclosureCases = JSON.parse(
        await readFile(join(root, "fixtures/forma-validation/cases/markdown-disclosures.json"), "utf8"),
    );
    await command(cli, ["--version"], 10_000, false, "version");
    await cp(join(root, "examples/minimal-workspace"), workspace, { recursive: true });
    await rm(join(workspace, "notes"), { recursive: true });
    await mkdir(join(workspace, "notes"));
    for (const [path, body] of [
        [
            "notes/sub/short-path-source.md",
            "# Short path source\n\n[Suffix link](guides/short-target.md?x=a%2Fb&x=2#section)\n\n[Nearby link](guides/nearby.md?x=1#section)\n\n[Exact link](/notes/guides/nearby.md?x=1#section)\n\n[Ambiguous link](guides/ambiguous.md?x=1#section)\n",
        ],
        ["notes/guides/short-target.md", "# Unique short-path target\n\n## Section\n"],
        ["notes/guides/nearby.md", "# Exact root target\n\n## Section\n"],
        ["notes/sub/guides/nearby.md", "# Nearby target\n\n## Section\n"],
        ["notes/guides/ambiguous.md", "# First ambiguous target\n\n## Section\n"],
        ["alternate/guides/ambiguous.md", "# Second ambiguous target\n\n## Section\n"],
    ]) {
        const source = join(workspace, path);
        await mkdir(dirname(source), { recursive: true });
        await writeFile(source, body);
    }
    const configPath = join(workspace, ".forma.md");
    const config = await readFile(configPath, "utf8");
    await writeFile(
        configPath,
        config
            .replace('    - "en"\n', '    - "en"\n    - "zh-Hans"\n')
            .replace('  - ".forma/spaces/*.md"\n', '  - ".forma/spaces/*.md"\n  - ".forma/topics/*.md"\n'),
    );
    await mkdir(join(workspace, ".forma/topics"));
    const classificationLabel = "Deployment and workspace configuration documentation";
    const longClassificationLabel = "Deployment ConfigurationManagementDocumentationProductionRelease";
    const classificationEntries = [
        ["classification-layout", `${classificationLabel}-`],
        ["classification-space-layout", `${classificationLabel} `],
        ["classification-ideographic-layout", `${classificationLabel}\\u3000`],
        ["classification-line-layout", `${classificationLabel}\\u2028`],
        ["classification-paragraph-layout", `${classificationLabel}\\u2029`],
        ["classification-long-layout", "ProductionConfigurationDeploymentManagementDocumentation"],
        ["classification-comma-layout", "Primary"],
        ["classification-long-mark-layout", longClassificationLabel],
        ["classification-long-comma-layout", "Primary"],
        ["classification-mixed-space-layout", `${classificationLabel}\\u2028\\u00a0`],
        ["classification-mixed-bidi-layout", `${classificationLabel}\\u2028\\u200f`],
        ["classification-cjk-bidi-layout", "日常プロジェクト運営資料と構成変更の詳細\\u3000\\u200f"],
        ["classification-figure-layout", "Lifecycle Owner" + "\\u2007".repeat(52)],
    ];
    await writeFile(
        join(workspace, ".forma/topics/index.md"),
        "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\nmode: secondary\n---\n",
    );
    await writeFile(
        join(workspace, ".forma/topics/reference.md"),
        `---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: Reference\ninclude: [${classificationEntries.map(([name]) => `${name}.md`).join(", ")}]\n---\n`,
    );
    for (const [name, title, document] of [
        ["classification-comma", `${classificationLabel} `, "classification-comma-layout"],
        ["classification-long-comma", longClassificationLabel, "classification-long-comma-layout"],
        ["classification-bidi-comma", `${classificationLabel}\\u2028\\u200f`, "classification-mixed-space-layout"],
    ]) {
        await writeFile(
            join(workspace, `.forma/topics/${name}.md`),
            `---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: "${title}"\ndisplay:\n  order: 1\ninclude: [${document}.md]\n---\n`,
        );
    }
    await mkdir(join(workspace, "graph"));
    await mkdir(join(workspace, "preview"));
    await writeFile(
        join(workspace, ".forma/spaces/mount-probe.md"),
        '---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Deployment path fixture\ninclude:\n  - "preview/**/*.md"\n  - "same.md"\n  - "contract-target.md"\n---\n',
    );
    for (const [name, title] of classificationEntries) {
        await writeFile(
            join(workspace, `.forma/spaces/${name}.md`),
            `---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: "${title}"\ninclude: [${name}.md]\n---\n`,
        );
        await writeFile(join(workspace, `${name}.md`), "# Classification layout\n");
    }
    await writeFile(
        join(workspace, ".forma/spaces/punctuation.md"),
        "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\nid: wow!\ntitle: Punctuation term\n---\n",
    );
    await writeFile(join(workspace, "same.md"), "# Root document\n");
    await writeFile(
        join(workspace, ".forma/views/wow!.md"),
        "---\nschemaVersion: 1\nkind: view\ntitle: Punctuation View\nmode: table\nsource:\n  type: pages\n  taxonomy:\n    spaces: [graph]\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n      link:\n        target: entry\n---\n",
    );
    for (const [id, title] of [
        ["hash#", "Hash View"],
        ["query?", "Query View"],
        ["literal%2F", "Literal slash View"],
        ["literal%25", "Literal percent View"],
    ]) {
        await writeFile(
            join(workspace, `.forma/views/${id}.md`),
            `---\nschemaVersion: 1\nkind: view\ntitle: ${title}\nmode: table\nsource:\n  type: pages\n  taxonomy:\n    spaces: [graph]\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n      link:\n        target: entry\n---\n`,
        );
    }
    await writeFile(
        join(workspace, ".forma/spaces/literal-percent.md"),
        "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\nid: literal%2F\ntitle: Literal slash term\n---\n",
    );
    for (const [name, title] of [
        ["route space", "Encoded space target"],
        ["literal%20", "Literal escape target"],
        ["hash #中文!", "Punctuation target"],
        ["target", "Single extension"],
        ["target.md", "Double extension"],
    ]) {
        await writeFile(join(workspace, `notes/${name}.md`), `---\ntitle: ${title}\n---\n\n# ${title}\n`);
    }
    await writeFile(
        join(workspace, "notes/route-links.md"),
        "# Route links\n\n[Encoded space](./route%20space.md)\n\n[Literal escape](./literal%2520.md)\n\n[Punctuation](./hash%20%23%E4%B8%AD%E6%96%87!.md)\n\n[Double extension](./target.md.md)\n",
    );
    await writeFile(
        join(workspace, "notes/navigation-anchors.md"),
        [
            "# Anchor navigation",
            "[[#forma-heading-前缀|Local wiki alias]]",
            "[Local explicit alias](#forma-heading-%E5%89%8D%E7%BC%80)",
            "## 前缀",
            "## forma-heading-前缀",
            "[[#Duplicate|Local repeated title]]",
            "[[notes/navigation-anchors#Duplicate|Path-qualified repeated title]]",
            "#### Duplicate",
            "## Duplicate",
            "",
        ].join("\n\n"),
    );
    const notesTermPath = join(workspace, ".forma/spaces/notes.md");
    const notesTermConfig = await readFile(notesTermPath, "utf8");
    await writeFile(
        notesTermPath,
        notesTermConfig.replace(
            '  - "notes/**/*.md"\n',
            '  - "notes/**/*.md"\n  - "guides/**/*.mdx"\n  - "alternate/**/*.md"\n',
        ),
    );
    await mkdir(join(workspace, "guides/nested/deeper"), { recursive: true });
    await writeFile(join(workspace, "guides/navigation-target.mdx"), "# Alternate format\n\n## 第二节\n");
    await writeFile(
        join(workspace, "guides/nested/deeper/deep-basename.mdx"),
        "# Deep configured target\n\n## Deep section\n",
    );
    await writeFile(
        join(workspace, "guides/nested/deeper/dotted.v2.mdx"),
        "# Dotted configured target\n\n## Dotted section\n",
    );
    const resourceQuery = "?name=a%20b&literal=%2520&value=a%26b&plus=a+b#part%20one";
    await writeFile(
        configPath,
        [
            await readFile(configPath, "utf8"),
            "[[guides/navigation-target#第二节|Home MDX wiki]]",
            "[[deep-basename#Deep section|Home deep MDX]]",
            "[[guides/nested/deeper/dotted.v2#Dotted section|Home dotted MDX]]",
            "[Home resource](./notes/contract-raw.txt" + resourceQuery + ")",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, "notes/navigation-source.md"),
        [
            "# Navigation source",
            "[[notes/navigation-anchors#forma-heading-前缀|Cross-entry wiki alias]]",
            "[[notes/navigation-anchors#Duplicate|Cross-entry repeated title]]",
            "[[guides/navigation-target.mdx#第二节|Explicit MDX wiki]]",
            "[[guides/navigation-target#第二节|Extensionless MDX wiki]]",
            "[Ordinary MDX link](../guides/navigation-target.mdx#第二节)",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, "notes/contract-target.md"),
        [
            "---\ntitle: Contract target\n---",
            "# Contract target",
            "## Hello world\n\nFragment target.",
            "## 第一节\n\nFirst heading.",
            "## 第二节\n\nSecond heading.",
            "## 版本 v2",
            "## forma-heading-前缀",
            "## Host Visual — 2026-09-24",
            "",
        ].join("\n\n"),
    );
    await writeFile(join(workspace, "notes/omitted-title.md"), "# 总览\n\n## 正文\n");
    await writeFile(join(workspace, "notes/omitted-collision.md"), "# Alias owner\n\n## Forma heading alias owner\n");
    await writeFile(join(workspace, "notes/legacy-omitted.md"), "# Hello world\n\n## Body\n");
    await writeFile(
        join(workspace, "notes/double-omitted.md"),
        "# Forma heading foo\n\n## Foo\n\n## Forma heading forma heading foo\n",
    );
    await writeFile(
        join(workspace, "notes/published-heading-links.md"),
        [
            "# Published heading links",
            "[Uppercase omitted title](./legacy-omitted.md#HELLO-WORLD)",
            "[Underscore omitted title](./legacy-omitted.md#hello_world)",
            "[Named double collision](./double-omitted.md#Forma%20heading%20foo)",
            "[Body alias after collision](./double-omitted.md#forma-heading-foo)",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, "notes/shell-heading-links.md"),
        [
            "# Shell heading links",
            "[Root title link](#Root)",
            "[Entry top title link](#Entry%20top)",
            "[Config title link](#Forma%20static%20workspace)",
            "[Main title link](#Main%20content)",
            "[Navigation title link](#Workspace%20navigation)",
            "[Sidebar title link](#Workspace%20sidebar)",
            "[Related title link](#Related%20documents)",
            "[Theme heading](#workspace-theme-menu)",
            "[Quick open heading](#workspace-quick-open)",
            "[Reader label heading](#reader-heading-label-1)",
            "[Related entry](./navigation-anchors.md)",
            "## Root",
            "## Entry top",
            "## Forma static workspace",
            "## Main content",
            "## Workspace navigation",
            "## Workspace sidebar",
            "## Related documents",
            "## Workspace theme menu",
            "## Workspace quick open",
            "## Reader heading label 1",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, "notes/footnote-heading-links.md"),
        [
            "# Footnote heading links",
            "[Authored heading](#user-content-fn-note)",
            "## User content fn note",
            "## User content fnref note",
            "Real note[^note].",
            "[^note]: Note body.",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, ".forma/views/view-heading-intro.md"),
        [
            "---\nschemaVersion: 1\nkind: view\ntitle: View heading intro\nmode: list\nsource:\n  type: pages\n  taxonomy:\n    spaces: [graph]\n---",
            "An introductory paragraph.",
            "# Secondary view title",
            "## Setup",
            "[Setup](#setup)",
            "[Deploy](#deploy)",
            "<!-- forma:content -->",
            "## Deploy",
            "",
        ].join("\n\n"),
    );
    const navigationViewConfig =
        "schemaVersion: 1\nkind: view\nmode: list\nsource:\n  type: pages\n  taxonomy:\n    spaces: [graph]";
    await writeFile(
        join(workspace, ".forma/views/view-navigation-split.md"),
        [
            "---\ntitle: Split navigation View\n" + navigationViewConfig + "\n---",
            "# Forma heading foo",
            "See a note[^body].",
            "[Heading within note](#footnote-detail)",
            "[Change View query](?mode=detail&tag=one&tag=two#footnote-detail)",
            "[[guides/navigation-target#第二节|View MDX wiki]]",
            "[[deep-basename#Deep section|View deep MDX]]",
            "[[guides/nested/deeper/dotted.v2#Dotted section|View dotted MDX]]",
            "[[guides/navigation-target#第二节|Guide ] beta]]",
            "[View resource](../../notes/contract-raw.txt" + resourceQuery + ")",
            "<!-- forma:content -->",
            "## Foo",
            "## Forma heading forma heading foo",
            "[^body]: Note intro.\n\n    ## Footnote detail",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, ".forma/views/view-audited-headings.md"),
        [
            "---\ntitle: Audited heading View\n" + navigationViewConfig + "\n---",
            "<!-- ordinary comment -->",
            "# Title 🌟",
            "[Jump to subtitle](#title)",
            "Before projection <!-- forma:content --> After inline projection.",
            "## After 💡",
            "[Jump to second title](#after)",
            "",
        ].join("\n\n"),
    );
    for (const [id, definition] of [
        ["nested", "[^a]: First note calls [^b].\n\n    ## Heading in first note"],
        ["unused", "[^unused]: Unused note calls [^b].\n\n    ## Heading in unused note"],
    ]) {
        await writeFile(
            join(workspace, ".forma/views/view-" + id + "-footnotes.md"),
            [
                "---\ntitle: Audited footnote View\n" + navigationViewConfig + "\n---",
                "# Footnote title",
                definition,
                "Call first note[^a].",
                "[First note heading](#heading-in-first-note)",
                "<!-- forma:content -->",
                "Call second note[^b].",
                ...(id === "unused" ? ["[^a]: First note.\n\n    ## Heading in first note"] : []),
                "[^b]: Second note.\n\n    ## Heading in second note",
                "",
            ].join("\n\n"),
        );
    }
    await writeFile(
        join(workspace, ".forma/views/view-navigation-comment.md"),
        [
            "---\ntitle: Comment navigation View\n" + navigationViewConfig + "\n---",
            "<!-- ordinary comment -->",
            "# 中文副标题",
            "[Legacy title id](#section)",
            "<!-- forma:content -->",
            "## Setup",
            "",
        ].join("\n\n"),
    );
    await writeFile(join(workspace, "contract-target.md"), "# Wrong root target\n");
    await writeFile(
        join(workspace, "notes/contract-target.zh-hans.md"),
        "---\ntitle: Localized target\n---\n\n# Localized target\n",
    );
    await writeFile(join(workspace, "notes/contract-raw.txt"), "CONTRACT_RAW_RESOURCE\n");
    await cp(
        join(root, "fixtures/forma-validation/samples/markdown/image-viewer.svg"),
        join(workspace, "notes/contract #%.svg"),
    );
    await writeFile(
        join(workspace, "notes/link-contracts.md"),
        [
            "# Link contracts",
            "[Encoded entry](./contract-target%2Emd#hello%2Dworld)",
            "[Reference destination][entry-ref]",
            "[[notes/contract-target#第二节|Second named section]]",
            "[[notes/contract-target#不存在|Missing named section]]",
            "[[notes/contract-target#缺失版本 v2|Missing mixed heading]]",
            "[Encoded blank fragment](./contract-target.md#%20)",
            "[[notes/contract-target#forma-heading-前缀|Reserved prefix heading]]",
            "[[notes/contract-target#Host-Visual-—-2026-09-24|Hyphenated heading with punctuation]]",
            "[[notes/omitted-title#总览|Omitted named title]]",
            "[Explicit title alias](./omitted-title.md#forma-heading-%E6%80%BB%E8%A7%88)",
            "[[notes/omitted-collision#Alias owner|Omitted title with alias collision]]",
            "[entry-ref]: /notes/contract-target.md",
            "[[#Local heading|Wiki jump]]",
            "## Local heading",
            "![Encoded image](./contract%20%23%25.svg?value=a%26b)",
            "[Encoded resource](./contract-raw.txt?name=a%20b&literal=%2520&value=a%26b&plus=a+b#part%20one)",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, ".forma/views/link-contracts.md"),
        "---\nschemaVersion: 1\nkind: view\ntitle: Link contracts View\nmode: list\nsource:\n  type: pages\n  taxonomy:\n    spaces: [graph]\n---\n\n# forma-heading-repeat\n\n[Root source](/notes/contract-target.md#hello-world)\n\n[Encoded source](../../notes/contract-target%2Emd#hello%2Dworld)\n\n[Localized source](/notes/contract-target.zh-hans.md)\n\n[Second heading](#repeat-2)\n\n[Across projection][projection-target]\n\n## Repeat\n\nFirst section.\n\n<!-- forma:content -->\n\n## Repeat\n\nSecond section.\n\n[projection-target]: /notes/contract-target.md\n",
    );
    await writeFile(join(workspace, "preview/index.md"), "# Folder landing\n");
    await writeFile(
        join(workspace, "preview/same.md"),
        "# Mounted document\n\n[Jump to details](#details)\n\n## Details\n\nMounted body.\n",
    );
    for (const name of [
        "images.md",
        "image-links.md",
        "viewers.md",
        "mermaid.md",
        "mermaid-geometry.md",
        "callouts.md",
        "callout-review.md",
        "reading-p1.md",
        "disclosures.md",
        "callout-compatibility.md",
        "callout-interaction.md",
        "callout-layout.md",
        "image-viewer.svg",
        "image-viewer-tall.svg",
    ]) {
        await cp(join(root, "fixtures/forma-validation/samples/markdown", name), join(workspace, "notes", name));
    }
    const disclosuresPath = join(workspace, "notes/disclosures.md");
    const disclosuresSample = await readFile(disclosuresPath, "utf8");
    await writeFile(
        disclosuresPath,
        disclosuresSample.replace(
            "[Jump to hidden heading]",
            "The first footnote reference is outside the disclosures[^folded].\n\n[Jump to hidden heading]",
        ),
    );
    const longCallout = Array.from(
        { length: 43 },
        (_, index) => `> Context ${index + 1}. This paragraph takes space above the final footnote reference.`,
    ).join("\n>\n");
    await writeFile(
        join(workspace, "notes/folded-footnote-navigation.md"),
        [
            "# Folded footnote navigation",
            "## Reading context",
            `> [!note]- A long folded section\n>\n${longCallout}\n>\n> [Before the footnote](#reading-context) note[^tail] [After the footnote](#reading-context).`,
            "[^tail]: The reference near the end of the folded section.",
            "",
        ].join("\n\n"),
    );
    await writeFile(
        join(workspace, "notes/query-fragment-navigation.md"),
        [
            "# Query and fragment navigation",
            "[Keep query and jump](?mode=source&value=a%2Fb&tag=one&tag=two#user-content-fnref-review)",
            "[Change query and jump](?mode=next&value=a%3Fb&tag=one&tag=two#user-content-fnref-review)",
            "[Exact entry query](./contract-target.md?value=a%2Fb&tag=one&tag=two#hello-world)",
            "[Alias entry query](./contract-target?value=a%2Fb&tag=one&tag=two#hello-world)",
            "[Index entry query](./resource-directory.txt/index.md?value=a%2Fb&tag=one&tag=two#details)",
            "[Sidecar entry query](../guides/query-sidecar.txt?value=a%2Fb&tag=one&tag=two#details)",
            "> [!note]- Folded review target\n>\n> See the footnote[^review].",
            "[^review]: Back to the review target.",
            "",
        ].join("\n\n"),
    );
    await mkdir(join(workspace, "notes/resource-directory.txt"));
    await writeFile(
        join(workspace, "notes/resource-directory.txt/index.md"),
        "# Directory entry\n\n## Details\n\nDirectory alias content.\n",
    );
    await writeFile(join(workspace, "notes/raw-source.txt"), "FORMA_RAW_SOURCE_BROWSER_PROBE\n");
    await writeFile(join(workspace, "guides/query-sidecar.txt.mdx"), "# Sidecar entry\n\n## Details\n");
    await writeFile(
        join(workspace, "notes/raw-source.txt.md"),
        "# Raw source sidecar\n\n[Original source](./raw-source.txt?download=1#part)\n\n[Directory entry](./resource-directory.txt#details)\n",
    );
    // A deep, long-titled page probes that the sidebar tree truncates instead of widening.
    await mkdir(join(workspace, "notes/sidebar/nested"), { recursive: true });
    await writeFile(
        join(workspace, "notes/sidebar/nested/long-title.md"),
        "# Sidebar Fit Probe With An Exceptionally Long Title That Must Truncate Inside The Navigation Tree\n\nBody.\n",
    );
    for (const fixture of disclosureCases) {
        await writeFile(join(workspace, "notes", `fold-${fixture.id}.md`), `# Disclosure case\n\n${fixture.source}\n`);
    }
    for (const fixture of readingCases) {
        await writeFile(join(workspace, "notes", `p1-${fixture.id}.md`), `# Reading P1\n\n${fixture.source}\n`);
    }
    await writeFile(
        join(workspace, "notes/callout-boundaries.md"),
        // Retain the basic sample's authored fragment destination in the combined page.
        "# Exact callout boundaries\n\n## Basic callouts\n\n" +
            calloutBoundaries.map((fixture) => `## ${fixture.id}\n\n${fixture.source}`).join("\n\n"),
    );
    await writeFile(
        join(workspace, ".forma/spaces/graph.md"),
        '---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Graph fixture\ninclude:\n  - "graph/**/*.md"\n---\n',
    );
    await writeFile(join(workspace, "graph/selected.md"), "---\ntitle: Selected node\n---\n\n# Selected node\n");
    await writeFile(
        join(workspace, ".forma/views/graph.md"),
        "---\nschemaVersion: 1\nkind: view\ntitle: Browser graph\nmode: graph\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - graph\ngraph:\n  edges:\n    - source: body\n      intent: link\n---\n",
    );

    abort.signal.throwIfAborted();
    const rpcWebapp = join(temporary, "webapp");
    await cp(join(root, "packages/webapp/dist"), rpcWebapp, { recursive: true });
    async function startRpc(prefix) {
        const backend = spawn(
            binary,
            [
                "serve",
                "-w",
                workspace,
                "--webapp-dir",
                rpcWebapp,
                "--bind",
                "127.0.0.1:0",
                "--root-path",
                prefix || "/",
            ],
            { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
        );
        backends.push(backend);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("WebApp server did not become ready")), 30_000);
            const finish = (error, value) => {
                clearTimeout(timer);
                error ? reject(error) : resolve(value);
            };
            abort.signal.addEventListener("abort", () => finish(abort.signal.reason), { once: true });
            const consume = (data) => {
                backendLog += data;
                const match = String(data).match(/forma serve listening on (http:\/\/127\.0\.0\.1:\d+)/u);
                if (match) finish(undefined, match[1]);
            };
            backend.stdout.on("data", consume);
            backend.stderr.on("data", consume);
            backend.once("error", (error) => finish(error));
            backend.once("exit", (code) => finish(new Error(`WebApp exited ${code}: ${backendLog}`)));
        });
    }
    async function startStatic(prefix, directory, label) {
        const server = createServer(async (request, response) => {
            try {
                const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
                if (pathname === "/favicon.ico") {
                    response.writeHead(204);
                    response.end();
                    return;
                }
                if (!pathname.startsWith(prefix + "/")) throw new Error("Outside root");
                let file = resolve(directory, pathname.slice(prefix.length + 1));
                if (file !== directory && !file.startsWith(directory + sep)) throw new Error("Outside site");
                if ((await stat(file)).isDirectory()) file = join(file, "index.html");
                response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
                response.end(await readFile(file));
            } catch {
                response.writeHead(404);
                response.end("Not found");
            }
        });
        staticServers.push(server);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const origin = `http://127.0.0.1:${server.address().port}`;
        const build = await command(
            binary,
            [
                "site",
                "build",
                "-w",
                workspace,
                "--out",
                directory,
                "--base-url",
                origin,
                "--root-path",
                prefix || "/",
                "--json",
            ],
            60_000,
            false,
            label,
        );
        await writeFile(join(artifacts, label + ".json"), build);
        const { status, diagnostics } = JSON.parse(build);
        const [ambiguity] = diagnostics;
        if (
            status !== "warning" ||
            diagnostics.length !== 1 ||
            ambiguity.code !== "entryRef.ambiguous" ||
            ambiguity.path !== "notes/sub/short-path-source.md" ||
            ambiguity.actual !== "guides/ambiguous.md?x=1#section"
        )
            throw new Error(`Unexpected static fixture diagnostics: ${JSON.stringify(diagnostics)}`);
        return origin;
    }
    const origin = await startRpc("");
    const previewOrigin = await startRpc("/preview");
    const staticOrigin = await startStatic("/preview", site, "static-build");
    const staticRootOrigin = await startStatic("", join(temporary, "site-root"), "static-root-build");
    const routeMatrix = [
        { name: "webapp", root: "", origin },
        { name: "webapp", root: "/preview", origin: previewOrigin },
        { name: "static", root: "", origin: staticRootOrigin },
        { name: "static", root: "/preview", origin: staticOrigin },
    ];
    const options = {
        artifacts,
        calloutBoundaries,
        readingCases,
        disclosureCases,
        hosts: [
            { name: "webapp", origin, root: "", graph: "/-/views/graph" },
            { name: "static", origin: staticOrigin, root: "/preview", graph: "/-/views/graph/" },
        ],
    };
    abort.signal.throwIfAborted();
    browserStarted = true;
    await browserCommand("open", "--browser", process.env.FORMA_BROWSER ?? "chromium");
    const results = [];
    // Bound each host independently; growing syntax coverage must not consume
    // the interaction suite's cumulative command deadline.
    const phases = markdownBrowserPhases(options.hosts, {
        reading: readingCases.map((fixture) => fixture.id),
        callouts: calloutBoundaries.map((fixture) => fixture.id),
        disclosures: disclosureCases.map((fixture) => fixture.id),
    });
    phases.unshift({
        name: "route-matrix",
        mode: "route-matrix",
        hosts: routeMatrix,
        expectedSourceCases: {},
        expectedResults: routeMatrix.flatMap(({ name, root }) =>
            (name === "static" ? ["initial", "enhanced"] : ["rpc"]).flatMap((surface) => [
                `${surface} ${root || "/"}: exact routes and query/fragment`,
                `${surface} ${root || "/"}: authored Markdown short-path resolution`,
            ]),
        ),
    });
    phases.push({
        name: "reader-test-regressions",
        mode: "reader-test-regressions",
        expectedSourceCases: {},
        expectedResults: readerBrowserChecks,
    });
    const completedPhases = [];
    for (const phase of phases) {
        abort.signal.throwIfAborted();
        const scenario = join(temporary, `scenarios-${phase.name}.js`);
        const run = phase.mode === "mermaid-geometry" ? markdownMermaidGeometry : markdownBrowserScenarios;
        const source =
            phase.mode === "reader-test-regressions"
                ? readerBrowserRegressionSource()
                : `async page => (${run})(page, ${JSON.stringify({ ...options, ...phase })}${run === markdownBrowserScenarios ? `, ${observeReader}` : ""})`;
        await writeFile(scenario, source);
        const output = await command(
            cli,
            [`-s=${session}`, "run-code", `--filename=${scenario}`],
            120_000,
            false,
            `run-code-${phase.name}`,
        );
        const result = parseMarkdownBrowserPhase(output, phase);
        results.push(...result.results);
        completedPhases.push({
            name: phase.name,
            checks: result.results,
            sourceCases: result.sourceCases,
        });
        await writeBrowserEvidence(join(artifacts, "phase-results.json"), completedPhases, { signal: abort.signal });
        console.log(`Completed browser phase: ${phase.name}`);
    }
    testResult = { status: "FORMA_MARKDOWN_BROWSER_PASSED", results };
} catch (error) {
    console.error(`Browser regression failed; artifacts: ${artifacts}`);
    await writeFile(
        join(artifacts, "failure.json"),
        JSON.stringify({
            status: interrupted ? "interrupted" : "failed",
            signal: interrupted,
            error: describeBrowserEvidenceError(error),
        }),
    );
    if (!interrupted) throw error;
} finally {
    await cleanup();
}
if (testResult && !interrupted) {
    const resultPath = join(artifacts, "result.json");
    try {
        await writeBrowserEvidence(resultPath, testResult, { signal: abort.signal, discardOnAbort: true });
        abort.signal.throwIfAborted();
        process.stdout.write(JSON.stringify(testResult, null, 2) + `\nArtifacts: ${artifacts}\n`);
    } catch (error) {
        await rm(resultPath, { force: true });
        await writeFile(
            join(artifacts, "failure.json"),
            JSON.stringify({
                status: interrupted ? "interrupted" : "failed",
                signal: interrupted,
                error: describeBrowserEvidenceError(error),
            }),
        );
        if (!interrupted) throw error;
    }
}

function cleanup() {
    return (cleanupPromise ??= (async () => {
        const errors = [];
        const attempt = async (action) => {
            try {
                await action();
            } catch (error) {
                errors.push(describeBrowserEvidenceError(error));
            }
        };
        // Startup has settled before finally runs: a close cannot race a later open.
        if (browserStarted) await attempt(() => browserCommand("close"));
        for (const backend of backends) await attempt(() => stop(backend));
        for (const server of staticServers)
            await attempt(async () => {
                server.closeAllConnections();
                await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
            });
        await attempt(() => writeFile(join(artifacts, "backend.log"), backendLog));
        await attempt(() => rm(temporary, { recursive: true, force: true }));
        await writeFile(
            join(artifacts, "cleanup.json"),
            JSON.stringify(
                {
                    status: errors.length ? "failed" : "passed",
                    interrupted,
                    backends: backends.map((backend) => ({
                        pid: backend.pid,
                        exitCode: backend.exitCode,
                        signal: backend.signalCode,
                    })),
                    errors,
                },
                null,
                2,
            ),
        );
        if (errors.length) throw new Error(`Cleanup failed: ${errors.join("; ")}`);
    })());
}
