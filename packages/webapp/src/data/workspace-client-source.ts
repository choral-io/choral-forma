import { RpcWorkspaceClient } from "./rpc-workspace-client";
import type { WorkspaceClient } from "./workspace-client";

const env = import.meta.env as {
    readonly VITE_FORMA_RPC_ENDPOINT?: string;
};
const rpcEndpoint = env.VITE_FORMA_RPC_ENDPOINT;

export const workspaceClient: WorkspaceClient = new RpcWorkspaceClient(rpcEndpoint);
