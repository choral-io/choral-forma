import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

export function browserTestConfig(suite) {
    const report = fileURLToPath(new URL(`../../dist/${suite}-browser/`, import.meta.url));
    return {
        testMatch: `${suite}.spec.mjs`,
        workers: 1,
        forbidOnly: !!process.env.CI,
        timeout: 90_000,
        expect: { timeout: 12_000 },
        reporter: [["list"], ["json", { outputFile: join(report, "report.json") }]],
        outputDir: join(report, "artifacts"),
        use: {
            browserName: "chromium",
            launchOptions: { executablePath: process.env.FORMA_SITE_CHROMIUM ?? chromium.executablePath() },
            actionTimeout: 12_000,
            navigationTimeout: 12_000,
            screenshot: "only-on-failure",
            trace: "retain-on-failure",
        },
    };
}
