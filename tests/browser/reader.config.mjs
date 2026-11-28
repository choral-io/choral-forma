import { defineConfig } from "@playwright/test";

import { browserTestConfig } from "./browser-test-config.mjs";

export default defineConfig(browserTestConfig("reader"));
