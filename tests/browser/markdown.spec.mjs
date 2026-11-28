import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

import { test as base } from "@playwright/test";

import { describeBrowserEvidenceError } from "./markdown-evidence.mjs";
import { markdownFixtures } from "./markdown-fixture.mjs";
import { markdownMermaidGeometry } from "./markdown-mermaid-geometry.mjs";
import { markdownBrowserPhases, validateMarkdownBrowserPhase } from "./markdown-phase-plan.mjs";
import { markdownBrowserScenarios } from "./markdown-scenarios.mjs";

const test = base.extend(markdownFixtures);
const phases = [
    "route-matrix",
    "mermaid-geometry",
    "webapp-disclosures",
    "static-disclosures",
    "noscript-disclosures",
    "webapp-navigation",
    "static-navigation",
    "noscript-navigation",
    "webapp",
    "static",
    "noscript",
];

for (const name of phases) {
    test(name, async ({ browser, markdownWorkspace }, testInfo) => {
        const { hosts, routeMatrix, readingCases, calloutBoundaries, disclosureCases, evidenceDir } = markdownWorkspace;
        const routePhase = {
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
        };
        const plan = [
            routePhase,
            ...markdownBrowserPhases(hosts, {
                reading: readingCases.map((fixture) => fixture.id),
                callouts: calloutBoundaries.map((fixture) => fixture.id),
                disclosures: disclosureCases.map((fixture) => fixture.id),
            }),
        ];
        assert.deepEqual(
            plan.map((phase) => phase.name),
            phases,
            "Registered Markdown tests must match the phase plan",
        );
        const phase = plan.find((phase) => phase.name === name);
        const artifacts = testInfo.outputPath();
        await mkdir(artifacts, { recursive: true });
        const options = { readingCases, calloutBoundaries, disclosureCases, artifacts, ...phase };
        try {
            const result =
                name === "mermaid-geometry"
                    ? await markdownMermaidGeometry(browser, options)
                    : await markdownBrowserScenarios(browser, options, testInfo.attach.bind(testInfo));
            await testInfo.attach("phase-coverage", {
                body: JSON.stringify({ name, checks: result.results, sourceCases: result.sourceCases }, null, 2),
                contentType: "application/json",
            });
            validateMarkdownBrowserPhase(result, phase);
        } catch (error) {
            try {
                await testInfo.attach("phase-failure", {
                    body: `Fixture logs: ${evidenceDir}\n\n${describeBrowserEvidenceError(error)}`,
                    contentType: "text/plain",
                });
            } finally {
                throw error;
            }
        }
    });
}
