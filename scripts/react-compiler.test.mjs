import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../packages/webapp/", import.meta.url));
const require = createRequire(new URL("../packages/webapp/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);

for (const mode of ["production", "static"]) {
    test(`actual ${mode} config emits React Compiler memoization`, async () => {
        const cacheDir = await mkdtemp(join(tmpdir(), "forma-compiler-"));
        let server;
        try {
            const id = "/__react_compiler_probe.tsx";
            server = await createServer({
                root,
                mode,
                cacheDir,
                configFile: join(root, "vite.config.mjs"),
                logLevel: "error",
                server: { middlewareMode: true, hmr: false, watch: null },
                optimizeDeps: { noDiscovery: true, include: [] },
                plugins: [
                    {
                        name: "compiler-probe",
                        resolveId(source) {
                            if (source === id) return id;
                        },
                        load(source) {
                            if (source === id)
                                return "export function Probe({ label }: { label: string }) { return <div>{label}</div>; }";
                        },
                    },
                ],
            });
            const result = await server.transformRequest(id);
            assert.match(result.code, /react[\/_]compiler-runtime/);
            assert.match(result.code, /_c\(2\)/);
            assert.ok(result.code.includes("$[0] !== label"));
        } finally {
            try {
                await server?.close();
            } finally {
                await rm(cacheDir, { recursive: true, force: true });
            }
        }
    });
}
