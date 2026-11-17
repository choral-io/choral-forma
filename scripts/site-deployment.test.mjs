import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    environmentName,
    hasTrigger,
    job,
    jobNeeds,
    parseWorkflow,
    secretReferences,
    trigger,
} from "./workflow-contract.mjs";

const [gitignore, packageJsonSource, pnpmWorkspace, workflow, wranglerSource] = await Promise.all(
    [
        "../.gitignore",
        "../package.json",
        "../pnpm-workspace.yaml",
        "../.github/workflows/ci.yml",
        "../wrangler.jsonc",
    ].map(async (path) => await readFile(new URL(path, import.meta.url), "utf8")),
);

const packageJson = JSON.parse(packageJsonSource);
const wrangler = JSON.parse(wranglerSource.replace(/,\s*([}\]])/gu, "$1"));
const ci = parseWorkflow(workflow, "ci.yml");
const deploy = job(ci, "deploy-site");

test("configures an asset-only Cloudflare Worker with one production custom domain", () => {
    assert.equal(wrangler.name, "choral-forma-site");
    assert.equal(wrangler.compatibility_date, "2026-07-28");
    assert.equal(wrangler.workers_dev, false);
    assert.equal(wrangler.preview_urls, false);
    assert.deepEqual(wrangler.assets, {
        directory: "./dist/site",
        not_found_handling: "404-page",
        html_handling: "drop-trailing-slash",
    });
    assert.equal("main" in wrangler, false);
    assert.deepEqual(wrangler.routes, [
        {
            pattern: "forma.choral.io",
            custom_domain: true,
        },
    ]);
    assert.equal("kv_namespaces" in wrangler, false);
    assert.equal("images" in wrangler, false);
});

test("constrains Wrangler updates and keeps its platform binary installation explicit", () => {
    // Major upgrades require deployment compatibility review; minor and patch versions may advance.
    assert.match(packageJson.devDependencies.wrangler, /^~4\.\d+\.\d+$/u);
    assert.equal(packageJson.scripts["site:deploy"], "wrangler deploy");
    assert.equal(packageJson.scripts["site:deploy:dry-run"], "wrangler deploy --dry-run");
    assert.match(pnpmWorkspace, /^  workerd: true$/mu);
    assert.match(gitignore, /^\/dist\/$/mu);
    assert.match(gitignore, /^\.wrangler\/$/mu);
});

test("automatically deploys only a fully successful main push", () => {
    assert.equal(hasTrigger(ci, "pull_request"), true);
    assert.deepEqual(trigger(ci, "push").branches, ["main"]);
    assert.equal(environmentName(deploy), "forma.choral.io");
    assert.equal(deploy.environment.url, "https://forma.choral.io");
    const condition = deploy.if.replace(/\s+/gu, " ").trim();
    assert.doesNotMatch(condition, /\|\|/u);
    assert.match(condition, /^github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' &&/u);
    assert.deepEqual(jobNeeds(deploy).sort(), [
        "cli-release-build",
        "extension",
        "knowledge",
        "rust",
        "site",
        "unix-installer",
        "web",
        "windows-installer",
    ]);
});

test("binds the named static artifact to the current remote main commit", () => {
    const build = job(ci, "site");
    const buildCommands = build.steps.flatMap((step) => (typeof step.run === "string" ? [step.run] : [])).join("\n");
    const commands = deploy.steps.flatMap((step) => (typeof step.run === "string" ? [step.run] : [])).join("\n");
    assert.equal(commands.match(/git\/ref\/heads\/main/gu)?.length, 2);
    assert.match(commands, /current_main.*GITHUB_SHA/su);
    assert.match(buildCommands, /"\$\{site\}\/-\/\.forma-source-sha"/u);
    assert.match(commands, /site-cloudflare-regression\.mjs --verify-only/u);
    assert.doesNotMatch(commands, /(?:cargo build|site build|pnpm build)/u);
    assert.match(commands, /pnpm install --frozen-lockfile/u);
    assert.match(commands, /pnpm site:deploy/u);
    const downloads = deploy.steps.filter((step) => step.uses?.startsWith("actions/download-artifact@"));
    assert.deepEqual(
        downloads.map((step) => step.with?.name),
        ["forma-static-site", "forma-static-site-verification"],
    );
    assert.equal(downloads[0]?.with?.path, "dist/site");
    const gate = build.steps.findIndex((step) => step.run?.includes("site-cloudflare-regression.mjs"));
    const reports = build.steps.findIndex((step) => step.with?.name === "forma-static-site-verification");
    const upload = build.steps.findIndex((step) => step.with?.name === "forma-static-site");
    assert(gate >= 0 && gate < reports && reports < upload);
    assert.equal(build.steps[reports].with["if-no-files-found"], "error");
    assert.equal(build.steps[gate].if, undefined);
    assert.equal(build.steps[gate]["continue-on-error"], undefined);
    assert.match(
        build.steps[gate].run,
        /--forma-bin.*--artifact-dir.*--source-sha.*--config.*--playwright-cli.*--chromium-executable.*--report/su,
    );
    const verify = deploy.steps.findIndex((step) => step.run?.includes("--verify-only"));
    const publish = deploy.steps.findIndex((step) => step.run?.includes("pnpm site:deploy"));
    assert(verify >= 0 && verify < publish);
    assert.equal(deploy.steps[verify]["continue-on-error"], undefined);
    assert.equal(deploy.steps[verify].if, deploy.steps[publish].if);
});

test("keeps Cloudflare credentials in environment secrets", () => {
    assert.deepEqual(secretReferences(deploy), ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
    assert.doesNotMatch(JSON.stringify(wrangler), /account_id|api_token/u);
});
