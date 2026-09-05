import { accessSync, constants, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { downloadAndUnzipVSCode } from "@vscode/test-electron";

const cachePath = resolve(import.meta.dirname, "../.vscode-test");

export async function resolveVSCodeVersion(version, fetchVersions = fetch) {
    if (version !== "stable") return version;
    const response = await fetchVersions("https://update.code.visualstudio.com/api/releases/stable", {
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Cannot resolve stable VS Code: HTTP ${response.status}`);
    const versions = await response.json();
    if (!Array.isArray(versions) || !/^\d+\.\d+\.\d+$/u.test(versions[0])) {
        throw new Error("The VS Code stable release list has no concrete version.");
    }
    return versions[0];
}

export function installedVSCodeCandidates(platform = process.platform, env = process.env) {
    if (platform === "darwin") {
        return ["/Applications", join(homedir(), "Applications")].flatMap((base) =>
            ["Code", "Electron"].map((binary) => ({
                executablePath: join(base, "Visual Studio Code.app/Contents/MacOS", binary),
                appPath: join(base, "Visual Studio Code.app/Contents/Resources/app"),
            })),
        );
    }
    if (platform === "win32") {
        return [
            env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Programs/Microsoft VS Code"),
            env.ProgramFiles && join(env.ProgramFiles, "Microsoft VS Code"),
            env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Microsoft VS Code"),
        ]
            .filter(Boolean)
            .map((base) => ({ executablePath: join(base, "Code.exe"), appPath: join(base, "resources/app") }));
    }
    return ["/usr/share/code", "/usr/lib/code", "/opt/visual-studio-code", "/snap/code/current/usr/share/code"].map(
        (base) => ({ executablePath: join(base, "code"), appPath: join(base, "resources/app") }),
    );
}

export function findInstalledVSCode(version, candidates = installedVSCodeCandidates()) {
    for (const candidate of candidates) {
        try {
            const manifest = JSON.parse(readFileSync(join(candidate.appPath, "package.json"), "utf8"));
            const product = JSON.parse(readFileSync(join(candidate.appPath, "product.json"), "utf8"));
            if (manifest.version !== version || product.quality !== "stable" || product.applicationName !== "code")
                continue;
            accessSync(candidate.executablePath, constants.X_OK);
            return candidate.executablePath;
        } catch {
            // Missing, unreadable, or incomplete installations are not reusable.
        }
    }
    return undefined;
}

export function installedTestConfiguration(version, candidates, argv = process.argv) {
    // The test CLI applies this override after loading config; let it select the executable too.
    if (argv.some((arg) => arg === "--code-version" || arg.startsWith("--code-version="))) return { version };
    const executablePath = findInstalledVSCode(version, candidates);
    if (executablePath) console.log(`Reusing installed VS Code ${version}: ${executablePath}`);
    return { version, ...(executablePath ? { useInstallation: { fromPath: executablePath } } : {}) };
}

export async function resolveVSCodeExecutable(version, env = process.env) {
    if (env.VSCODE_EXECUTABLE_PATH) return env.VSCODE_EXECUTABLE_PATH;
    const exactVersion = await resolveVSCodeVersion(version);
    const installed = findInstalledVSCode(exactVersion);
    if (installed) {
        console.log(`Reusing installed VS Code ${exactVersion}: ${installed}`);
        return installed;
    }
    return await downloadAndUnzipVSCode({ version: exactVersion, cachePath });
}
