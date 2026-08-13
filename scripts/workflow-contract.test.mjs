import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { expectedReleaseAssetNames } from "./release-verification.mjs";
import {
    ciContractFailures,
    dependsOn,
    environmentName,
    job,
    normalizedPermissions,
    parseWorkflow,
    releaseContractFailures,
    secretReferences,
    workflowInputNames,
} from "./workflow-contract.mjs";

test("parses YAML 1.2 without coercing the on trigger into a boolean", () => {
    const workflow = parseWorkflow("on:\n  workflow_dispatch:\n    inputs:\n      version: {}\n", "fixture");
    assert.deepEqual(workflowInputNames(workflow), ["version"]);
});

test("exposes reusable job, dependency, environment, permission, and secret helpers", () => {
    const workflow = parseWorkflow(
        `
permissions:
  contents: read
jobs:
  publish:
    needs: [assemble]
    environment:
      name: production
    permissions:
      contents: write
    steps:
      - run: echo '\${{ secrets.CLOUDFLARE_API_TOKEN }}'
`,
        "fixture",
    );
    const publish = job(workflow, "publish");
    assert.equal(dependsOn(publish, "assemble"), true);
    assert.equal(environmentName(publish), "production");
    assert.deepEqual(normalizedPermissions(workflow, publish), { contents: "write" });
    assert.deepEqual(secretReferences(publish), ["CLOUDFLARE_API_TOKEN"]);
});

test("accepts a minimal artifact-promotion workflow fixture", () => {
    const release = parseWorkflow(
        `
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
jobs:
  build-cli-candidate:
    uses: ./.github/workflows/release-cli-build.yml
  build-vscode-candidate:
    uses: ./.github/workflows/release-vscode-build.yml
  assemble-candidate:
    needs: [build-cli-candidate, build-vscode-candidate]
    permissions:
      contents: read
  promote:
    needs: assemble-candidate
    environment: release-production
    permissions:
      contents: write
    steps:
      - run: |
          release_id="$(gh release view v1.0.0 --json databaseId --jq '.databaseId')"
          gh api "repos/example/project/releases/\${release_id}"
  verify-published-release:
    needs: promote
    permissions:
      contents: read
  publish-vscode-marketplace:
    needs: verify-published-release
    permissions:
      contents: read
      id-token: write
    steps:
      - run: pnpm --filter forma exec vsce publish --packagePath candidate.vsix --azure-credential
`,
        "release fixture",
    );
    const cliBuild = parseWorkflow(
        `
on:
  workflow_call:
jobs:
  build:
    permissions:
      contents: read
`,
        "release-cli-build fixture",
    );
    const vscodeBuild = parseWorkflow(
        `
on:
  workflow_call:
jobs:
  build:
    permissions:
      contents: read
`,
        "release-vscode-build fixture",
    );
    assert.deepEqual(
        releaseContractFailures({
            release,
            releaseCliBuild: cliBuild,
            releaseVscodeBuild: vscodeBuild,
        }),
        [],
    );
});

test("accepts a main-only automatic site deployment fixture", () => {
    const workflow = parseWorkflow(
        `
on:
  pull_request:
  push:
    branches: [main]
jobs:
  site:
    permissions:
      contents: read
  test:
    permissions:
      contents: read
  deploy-site:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [site, test]
    environment: forma.choral.io
    env:
      CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
`,
        "CI fixture",
    );
    assert.deepEqual(ciContractFailures(workflow), []);
});

test("rejects a deployment condition with an alternate non-main path", () => {
    const workflow = parseWorkflow(
        `
on:
  pull_request:
  push:
    branches: [main]
jobs:
  site: {}
  deploy-site:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    needs: site
    environment: forma.choral.io
    env:
      CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
`,
        "unsafe CI fixture",
    );
    assert.ok(ciContractFailures(workflow).includes("site deployment must run only for main pushes"));
});

test("rejects a Marketplace job that rebuilds a candidate artifact", () => {
    const release = parseWorkflow(
        `
on:
  workflow_dispatch:
    inputs:
      version: {}
jobs:
  build-cli-candidate:
    uses: ./.github/workflows/release-cli-build.yml
  build-vscode-candidate:
    uses: ./.github/workflows/release-vscode-build.yml
  assemble-candidate:
    needs: [build-cli-candidate, build-vscode-candidate]
  promote:
    needs: assemble-candidate
    environment: release-production
    permissions:
      contents: write
  verify-published-release:
    needs: promote
  publish-vscode-marketplace:
    needs: verify-published-release
    permissions:
      id-token: write
    steps:
      - run: pnpm --filter forma package:vsix
`,
        "unsafe release fixture",
    );
    const cliBuild = parseWorkflow("on:\n  workflow_call:\njobs: {}\n", "release-cli-build fixture");
    const vscodeBuild = parseWorkflow("on:\n  workflow_call:\njobs: {}\n", "release-vscode-build fixture");
    assert.ok(
        releaseContractFailures({
            release,
            releaseCliBuild: cliBuild,
            releaseVscodeBuild: vscodeBuild,
        }).includes("Marketplace publication must not rebuild or package the VSIX"),
    );
});

test("keeps the release pipeline structurally safe", async () => {
    const [releaseSource, releaseCliBuildSource, releaseVscodeBuildSource] = await Promise.all(
        ["release.yml", "release-cli-build.yml", "release-vscode-build.yml"].map(
            async (name) => await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"),
        ),
    );
    assert.deepEqual(
        releaseContractFailures({
            release: parseWorkflow(releaseSource, "release.yml"),
            releaseCliBuild: parseWorkflow(releaseCliBuildSource, "release-cli-build.yml"),
            releaseVscodeBuild: parseWorkflow(releaseVscodeBuildSource, "release-vscode-build.yml"),
        }),
        [],
    );
});

test("keeps the reusable release matrix and public asset contract exact", async () => {
    const [releaseSource, releaseCliBuildSource, releaseVscodeBuildSource, ciSource] = await Promise.all(
        ["release.yml", "release-cli-build.yml", "release-vscode-build.yml", "ci.yml"].map(
            async (name) => await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"),
        ),
    );
    const release = parseWorkflow(releaseSource, "release.yml");
    const releaseCliBuild = parseWorkflow(releaseCliBuildSource, "release-cli-build.yml");
    const releaseVscodeBuild = parseWorkflow(releaseVscodeBuildSource, "release-vscode-build.yml");
    const ci = parseWorkflow(ciSource, "ci.yml");
    const builder = job(release, "build-cli-candidate");
    const vscodeBuilder = job(release, "build-vscode-candidate");
    const cliBuildJob = job(releaseCliBuild, "cli");
    const rows = cliBuildJob.strategy.matrix.include;
    assert.deepEqual(rows, [
        {
            archive: "tar.gz",
            asset: "linux-arm64",
            binary: "forma",
            build_image: "rust:1.95-bullseye",
            glibc_minimum: 2.31,
            managed_binary: "forma-linux-arm64",
            os: "ubuntu-24.04-arm",
            target: "aarch64-unknown-linux-gnu",
        },
        {
            archive: "tar.gz",
            asset: "linux-x64",
            binary: "forma",
            build_image: "rust:1.95-bullseye",
            glibc_minimum: 2.31,
            managed_binary: "forma-linux-x64",
            os: "ubuntu-24.04",
            target: "x86_64-unknown-linux-gnu",
        },
        {
            archive: "tar.gz",
            asset: "macos-arm64",
            binary: "forma",
            managed_binary: "forma-macos-arm64",
            os: "macos-26",
            target: "aarch64-apple-darwin",
        },
        {
            archive: "tar.gz",
            asset: "macos-x64",
            binary: "forma",
            managed_binary: "forma-macos-x64",
            os: "macos-26-intel",
            target: "x86_64-apple-darwin",
        },
        {
            archive: "zip",
            asset: "windows-x64",
            binary: "forma.exe",
            managed_binary: "forma-windows-x64.exe",
            os: "windows-2025",
            target: "x86_64-pc-windows-msvc",
        },
    ]);
    assert.equal(builder.uses, "./.github/workflows/release-cli-build.yml");
    assert.deepEqual(Object.keys(builder.with), ["source_sha"]);
    assert.equal(vscodeBuilder.uses, "./.github/workflows/release-vscode-build.yml");
    assert.equal(vscodeBuilder.with.source_sha, "${{ needs.validate.outputs.source_sha }}");
    const ciBuilder = job(ci, "cli-release-build");
    assert.equal(ciBuilder.uses, "./.github/workflows/release-cli-build.yml");
    assert.deepEqual(Object.keys(ciBuilder.with), ["source_sha"]);
    assert.equal(ciBuilder.with.source_sha, "${{ github.sha }}");
    assert.deepEqual(Object.keys(releaseCliBuild.on.workflow_call.inputs), ["source_sha"]);
    assert.deepEqual(Object.keys(releaseCliBuild.jobs), ["cli"]);
    assert.deepEqual(Object.keys(releaseVscodeBuild.jobs), ["extension"]);
    assert.ok(
        stepRunCommandsForTest(cliBuildJob).some(
            (command) =>
                command.includes("cargo test --release --locked -p forma-cli self_update") &&
                command.includes("--target ${{ matrix.target }}"),
        ),
        "every release CLI target must run the self-update contract tests",
    );
    const cliCommands = stepRunCommandsForTest(cliBuildJob).join("\n");
    assert.match(cliCommands, /bash -c 'cargo (?:test|build)/su);
    assert.doesNotMatch(cliCommands, /bash -lc 'cargo/su);
    assert.match(cliCommands, /check-linux-gnu-abi\.mjs/su);
    assert.match(cliCommands, /debian:11-slim/su);
    assert.match(cliCommands, /debian:12-slim/su);
    assert.deepEqual(
        rows
            .filter(({ target }) => target.endsWith("-unknown-linux-gnu"))
            .map(({ build_image, glibc_minimum }) => ({ build_image, glibc_minimum })),
        [
            { build_image: "rust:1.95-bullseye", glibc_minimum: 2.31 },
            { build_image: "rust:1.95-bullseye", glibc_minimum: 2.31 },
        ],
    );

    const publishedNames = rows.flatMap(({ archive, asset, managed_binary }) => {
        const archiveName = `forma-${asset}.${archive}`;
        return [archiveName, `${archiveName}.sha256`, managed_binary, `${managed_binary}.sha256`];
    });
    assert.deepEqual(
        [...publishedNames, "forma-1.2.3.vsix", "forma-1.2.3.vsix.sha256"].sort(),
        expectedReleaseAssetNames("1.2.3"),
    );

    for (const releaseBuild of [releaseCliBuild, releaseVscodeBuild]) {
        assert.deepEqual(Object.keys(releaseBuild.on), ["workflow_call"]);
        assert.equal(secretReferences(releaseBuild).length, 0);
        for (const definition of Object.values(releaseBuild.jobs)) {
            assert.equal(definition.environment, undefined);
            assert.notEqual(definition.permissions?.contents, "write");
            assert.notEqual(definition.permissions?.["id-token"], "write");
            for (const step of definition.steps ?? []) {
                assert.notEqual(step.with?.overwrite, true);
                if (step.uses?.startsWith("actions/upload-artifact@")) {
                    assert.equal(step.with?.["retention-days"], 30);
                }
            }
        }
    }
});

test("binds release and deployment recovery paths to the exact source", async () => {
    const [releaseSource, ciSource] = await Promise.all(
        ["release.yml", "ci.yml"].map(
            async (name) => await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"),
        ),
    );
    const release = parseWorkflow(releaseSource, "release.yml");
    const ci = parseWorkflow(ciSource, "ci.yml");
    assert.deepEqual(release.concurrency, {
        "group": "forma-release-production",
        "queue": "max",
        "cancel-in-progress": false,
    });
    assert.match(stepRunCommandsForTest(job(release, "validate")).join("\n"), /GITHUB_REF.*refs\/heads\/main/su);

    for (const [id, definition] of Object.entries(release.jobs)) {
        for (const step of definition.steps ?? []) {
            if (!step.uses?.startsWith("actions/checkout@")) continue;
            assert.ok(
                String(step.with?.ref).includes("github.sha") ||
                    String(step.with?.ref).includes("needs.validate.outputs.source_sha"),
                `${id} checkout must use the exact candidate SHA`,
            );
        }
    }
    assert.equal(secretReferences(job(release, "promote")).length, 0);
    assert.equal(
        stepRunCommandsForTest(job(release, "promote")).some((command) => command.includes("--clobber")),
        false,
    );
    const promoteCommands = stepRunCommandsForTest(job(release, "promote")).join("\n");
    assert.match(promoteCommands, /\/git\/tags/u);
    assert.match(promoteCommands, /gh release view/u);
    assert.match(promoteCommands, /releases\/\$\{release_id\}/u);
    assert.match(promoteCommands, /verify-subset/u);
    assert.match(promoteCommands, /release-candidate\.mjs verify/u);

    const deployCommands = stepRunCommandsForTest(job(ci, "deploy-site")).join("\n");
    assert.equal(deployCommands.match(/git\/ref\/heads\/main/gu)?.length, 2);
    assert.match(deployCommands, /current_main.*GITHUB_SHA/su);
    assert.match(deployCommands, /\.forma-source-sha/u);
});

test("uses floating major tags for every remote action", async () => {
    for (const name of ["ci.yml", "release-cli-build.yml", "release-vscode-build.yml", "release.yml"]) {
        const source = await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
        const workflow = parseWorkflow(source, name);
        for (const [id, definition] of Object.entries(workflow.jobs)) {
            if (typeof definition.uses === "string" && !definition.uses.startsWith("./")) {
                assert.match(definition.uses, /@v[1-9]\d*$/u, `${name}:${id} must use a floating major tag`);
            }
            for (const step of definition.steps ?? []) {
                if (typeof step.uses !== "string" || step.uses.startsWith("./")) continue;
                assert.match(step.uses, /@v[1-9]\d*$/u, `${name}:${id} must use a floating major tag for ${step.uses}`);
            }
        }
    }
});

test("retains the complete CI, site, extension, and Zed gates", async () => {
    const [ciSource, releaseVscodeBuildSource] = await Promise.all(
        ["ci.yml", "release-vscode-build.yml"].map(
            async (name) => await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"),
        ),
    );
    const ci = parseWorkflow(ciSource, "ci.yml");
    const releaseVscodeBuild = parseWorkflow(releaseVscodeBuildSource, "release-vscode-build.yml");
    const webCommands = stepRunCommandsForTest(job(ci, "web")).join("\n");
    for (const command of ["pnpm check", "pnpm lint", "pnpm test", "pnpm build", "test:mermaid-worker-upgrade"]) {
        assert.ok(webCommands.includes(command), `web CI must retain ${command}`);
    }
    const siteCommands = stepRunCommandsForTest(job(ci, "site")).join("\n");
    for (const command of ["config inspect --json", "check --json", "workspace health --json", "site build"]) {
        assert.ok(siteCommands.includes(command), `site CI must retain ${command}`);
    }
    const siteUpload = job(ci, "site").steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    assert.deepEqual(
        {
            hidden: siteUpload?.with?.["include-hidden-files"],
            name: siteUpload?.with?.name,
            path: siteUpload?.with?.path,
        },
        { hidden: true, name: "forma-static-site", path: "dist/site" },
    );

    const rustCommands = stepRunCommandsForTest(job(ci, "rust")).join("\n");
    assert.match(rustCommands, /rustup target add wasm32-wasip1/u);
    assert.match(rustCommands, /cargo check -p forma-zed-extension --target wasm32-wasip1 --locked/u);
    const windowsInstaller = job(ci, "windows-installer");
    assert.equal(windowsInstaller["runs-on"], "windows-2025");
    assert.ok(
        stepRunCommandsForTest(windowsInstaller).some((command) =>
            command.includes("scripts/install-windows.test.ps1"),
        ),
    );
    const unixInstaller = job(ci, "unix-installer");
    assert.equal(unixInstaller["runs-on"], "ubuntu-24.04");
    assert.ok(
        stepRunCommandsForTest(unixInstaller).some((command) => command.includes("scripts/install-unix.test.sh")),
    );
    const ciExtension = job(ci, "extension");
    const integration = ciExtension.steps.find((step) => step.name === "Run Extension Host tests");
    assert.equal(integration?.env?.FORMA_TEST_BIN, "${{ github.workspace }}/target/debug/forma");
    assert.ok(stepRunCommandsForTest(ciExtension).some((command) => command.includes("smoke:vsix")));
    assert.ok(
        stepRunCommandsForTest(job(releaseVscodeBuild, "extension")).some((command) => command.includes("smoke:vsix")),
    );
});

test("automatically deploys only a fully gated main CI artifact", async () => {
    const source = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    assert.deepEqual(ciContractFailures(parseWorkflow(source, "ci.yml")), []);
});

function stepRunCommandsForTest(jobDefinition) {
    return (jobDefinition.steps ?? []).flatMap((step) => (typeof step.run === "string" ? [step.run] : []));
}
