import { rpcEndpointPath } from "@/lib/workspace-routes";

import { RpcWorkspaceClient } from "./rpc-workspace-client";
import { readStaticRuntimeConfig, rootAwareHref } from "./static-runtime";
import { StaticWorkspaceClient } from "./static-workspace-client";
import type { WorkspaceClient } from "./workspace-client";

declare const __FORMA_WORKSPACE_CLIENT__: "rpc" | "static";

const env = import.meta.env as {
    readonly VITE_FORMA_RPC_ENDPOINT?: string;
};
const rpcEndpoint = env.VITE_FORMA_RPC_ENDPOINT;

export const isStaticWorkspaceClient =
    typeof __FORMA_WORKSPACE_CLIENT__ !== "undefined" && __FORMA_WORKSPACE_CLIENT__ === "static";

export const workspaceClient: WorkspaceClient = isStaticWorkspaceClient
    ? new StaticWorkspaceClient(readStaticRuntimeConfig)
    : new RpcWorkspaceClient(rpcEndpoint ?? rootAwareHref(rpcEndpointPath));

export const staticWorkspaceClient =
    isStaticWorkspaceClient && workspaceClient instanceof StaticWorkspaceClient ? workspaceClient : undefined;
