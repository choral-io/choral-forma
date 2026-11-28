import { defineConfig } from "@playwright/test";

import { browserTestConfig } from "./browser-test-config.mjs";

const config = browserTestConfig("markdown");
const browserName = process.env.FORMA_BROWSER ?? "chromium";
if (!["chromium", "firefox", "webkit"].includes(browserName))
    throw new Error(`Unknown FORMA_BROWSER "${browserName}". Use chromium, firefox, or webkit.`);

export default defineConfig({
    ...config,
    timeout: 120_000,
    use: {
        ...config.use,
        browserName,
        launchOptions: browserName === "chromium" ? config.use.launchOptions : {},
        actionTimeout: 30_000,
        navigationTimeout: 30_000,
    },
});
