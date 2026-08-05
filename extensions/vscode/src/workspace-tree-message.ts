export function workspaceExplorerMessage(hasExplorer: boolean, loadFailed: boolean, runtimeState: string): string {
    if (hasExplorer) return "";
    if (loadFailed) return "Unable to load Forma Explorer. See Forma output for details.";
    if (runtimeState === "binaryMissing") {
        return "Forma CLI is unavailable. Use the Forma status menu for recovery.";
    }
    if (runtimeState === "restricted") return "Trust this workspace to load Forma Explorer.";
    if (runtimeState === "checking") return "Checking Forma workspace…";
    if (runtimeState === "failed") return "Forma is unavailable. See Forma output for details.";
    return "No active Forma workspace.";
}
