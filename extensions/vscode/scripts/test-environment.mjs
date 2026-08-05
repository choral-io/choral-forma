import { mkdir, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";

export function createTestEnvironment(environment, additions) {
    const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanEnvironment } = environment;
    return { ...cleanEnvironment, ...additions };
}

export function createFormaTestEnvironment(environment, formaTestBin, additions = {}, pathDelimiter = delimiter) {
    const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
    const currentPath = environment[pathKey];
    const executableDirectory = dirname(formaTestBin);
    const path = currentPath ? `${executableDirectory}${pathDelimiter}${currentPath}` : executableDirectory;
    return createTestEnvironment(environment, { ...additions, FORMA_TEST_BIN: formaTestBin, [pathKey]: path });
}

export function resolveFormaTestBin(environment, fallback) {
    return environment.FORMA_TEST_BIN ?? fallback;
}

export function shouldUseShellForCommand(command, platform = process.platform) {
    return platform === "win32" && /\.cmd$/iu.test(command);
}

export async function writeFormaTestSettings(userDataDirectory, formaTestBin) {
    const userSettingsDirectory = join(userDataDirectory, "User");
    const settingsPath = join(userSettingsDirectory, "settings.json");
    await mkdir(userSettingsDirectory, { recursive: true });
    await writeFile(settingsPath, `${JSON.stringify({ "forma.path": formaTestBin }, undefined, 4)}\n`);
    return settingsPath;
}
