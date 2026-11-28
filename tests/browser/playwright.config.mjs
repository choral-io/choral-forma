import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

import { browserTestConfig } from "./browser-test-config.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = process.platform === "win32" ? ".\\target\\debug\\forma.exe" : "./target/debug/forma";

export default defineConfig({
    ...browserTestConfig("getting-started"),
    webServer: {
        command: `${binary} --workspace examples/getting-started-workspace serve --webapp-dir packages/webapp/dist --bind 127.0.0.1:0`,
        cwd: root,
        wait: { stdout: /forma serve listening on http:\/\/127\.0\.0\.1:(?<forma_getting_started_port>\d+)/u },
        stdout: "pipe",
        stderr: "pipe",
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
});
