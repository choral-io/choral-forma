import { resolveFormaCommand } from "./forma-client.ts";
import { managedCliPath, type ManagedCliStorage } from "./managed-cli.ts";

export type FormaCommandResolution = {
    command: string;
    source: "explicit" | "managed" | "path";
};

export function formaCommandSourceLabel(source: FormaCommandResolution["source"]): string {
    switch (source) {
        case "explicit":
            return "forma.path";
        case "managed":
            return "managed extension storage";
        case "path":
            return "Extension Host PATH";
    }
}

export function formatFormaCommandProbe(
    resolution: FormaCommandResolution,
    expectedVersion: string,
    actualVersion: string,
    error?: string,
): string {
    const command = resolution.command.replace(/\s+/gu, " ").trim().slice(0, 240);
    const detail = error ? ` error=${JSON.stringify(error.replace(/\s+/gu, " ").trim().slice(0, 2_000))}` : "";
    return `[probe] source=${resolution.source} command=${JSON.stringify(command)} expected=${expectedVersion} actual=${actualVersion}${detail}`;
}

export async function resolveRuntimeFormaCommand(
    explicitUserPath: string | undefined,
    managedStorage: ManagedCliStorage,
    expectedVersion: string,
    isFile: (path: string) => Promise<boolean>,
    platform: NodeJS.Platform = process.platform,
): Promise<FormaCommandResolution> {
    if (explicitUserPath?.trim()) {
        return { command: resolveFormaCommand(explicitUserPath), source: "explicit" };
    }

    const managed = managedCliPath(managedStorage, expectedVersion, platform);
    if (await isFile(managed)) {
        return { command: managed, source: "managed" };
    }

    return { command: "forma", source: "path" };
}
