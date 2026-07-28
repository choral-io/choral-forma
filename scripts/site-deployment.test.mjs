import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [gitignore, packageJsonSource, pnpmWorkspace, workflow, wranglerSource] = await Promise.all(
    [
        "../.gitignore",
        "../package.json",
        "../pnpm-workspace.yaml",
        "../.github/workflows/deploy-site.yml",
        "../wrangler.jsonc",
    ].map(async (path) => await readFile(new URL(path, import.meta.url), "utf8")),
);

const packageJson = JSON.parse(packageJsonSource);
const wrangler = JSON.parse(wranglerSource.replace(/,\s*([}\]])/gu, "$1"));

test("configures an asset-only Cloudflare Worker without a production route", () => {
    assert.equal(wrangler.name, "choral-forma-site");
    assert.equal(wrangler.compatibility_date, "2026-07-28");
    assert.equal(wrangler.workers_dev, true);
    assert.equal(wrangler.preview_urls, true);
    assert.deepEqual(wrangler.assets, {
        directory: "./dist/site",
        not_found_handling: "404-page",
        html_handling: "auto-trailing-slash",
    });
    assert.equal("main" in wrangler, false);
    assert.equal("routes" in wrangler, false);
    assert.equal("kv_namespaces" in wrangler, false);
    assert.equal("images" in wrangler, false);
});

test("pins Wrangler and keeps its platform binary installation explicit", () => {
    assert.equal(packageJson.devDependencies.wrangler, "~4.114.0");
    assert.equal(packageJson.scripts["site:deploy"], "wrangler deploy");
    assert.equal(packageJson.scripts["site:deploy:dry-run"], "wrangler deploy --dry-run");
    assert.match(pnpmWorkspace, /^  workerd: true$/mu);
    assert.match(gitignore, /^\/dist\/$/mu);
});

test("keeps production deployment manual, serialized, and approval-gated", () => {
    assert.match(workflow, /^on:\n  workflow_dispatch:/mu);
    assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|schedule):/mu);
    assert.match(workflow, /^  cancel-in-progress: false$/mu);
    assert.match(workflow, /^    if: github\.ref == 'refs\/heads\/main'$/mu);
    assert.match(workflow, /environment:\n      name: forma\.choral\.io\n      url: https:\/\/forma\.choral\.io/u);
    assert.match(workflow, /^  actions: read$/mu);
    assert.match(workflow, /^  contents: read$/mu);
});

test("deploys only the named artifact from a successful main CI run at the exact source commit", () => {
    assert.match(workflow, /ci_run_id:[\s\S]*?required: true[\s\S]*?source_sha:[\s\S]*?required: true/u);
    assert.match(workflow, /actions\/runs\/\$\{CI_RUN_ID\}/u);
    assert.match(workflow, /test "\$\(jq -r '\.name'[\s\S]*?= "CI"/u);
    assert.match(workflow, /test "\$\(jq -r '\.head_branch'[\s\S]*?= "main"/u);
    assert.match(workflow, /test "\$\(jq -r '\.head_sha'[\s\S]*?= "\$\{SOURCE_SHA\}"/u);
    assert.match(workflow, /test "\$\(jq -r '\.conclusion'[\s\S]*?= "success"/u);
    assert.match(workflow, /uses: actions\/checkout@v7[\s\S]*?ref: \$\{\{ inputs\.source_sha \}\}/u);
    assert.match(
        workflow,
        /gh run download "\$\{CI_RUN_ID\}"[\s\S]*?--name forma-static-site[\s\S]*?--dir dist\/site/u,
    );
    assert.match(workflow, /pnpm install --frozen-lockfile/u);
    assert.match(workflow, /pnpm site:deploy/u);
});

test("keeps Cloudflare credentials in environment secrets", () => {
    assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/u);
    assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/u);
    assert.doesNotMatch(workflow, /account_id:/u);
    assert.doesNotMatch(workflow, /api_token:/u);
});
