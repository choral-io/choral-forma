import { RpcWorkspaceClient } from "./rpc-workspace-client";
import { StaticWorkspaceClient } from "./static-workspace-client";
import type { WorkspaceClient } from "./workspace-client";

declare const __FORMA_WORKSPACE_CLIENT__: "rpc" | "static";

const env = import.meta.env as {
    readonly VITE_FORMA_RPC_ENDPOINT?: string;
};
const rpcEndpoint = env.VITE_FORMA_RPC_ENDPOINT;

function readStaticDataBaseUrl(): string {
    const config = globalThis.__FORMA_STATIC_WORKSPACE__;
    if (!config?.dataBaseUrl) {
        throw new Error("Static artifact configuration is missing its data base URL.");
    }
    return config.dataBaseUrl;
}

export const workspaceClient: WorkspaceClient =
    __FORMA_WORKSPACE_CLIENT__ === "static"
        ? new StaticWorkspaceClient(readStaticDataBaseUrl())
        : new RpcWorkspaceClient(rpcEndpoint);
