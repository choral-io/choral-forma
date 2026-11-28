import { defineConfig } from "@playwright/test";

import { browserTestConfig } from "./browser-test-config.mjs";

const config = browserTestConfig("cloudflare");

export default defineConfig({
    ...config,
    timeout: 120_000,
    use: {
        ...config.use,
        actionTimeout: 30_000,
        navigationTimeout: 30_000,
        reducedMotion: "no-preference",
    },
});
