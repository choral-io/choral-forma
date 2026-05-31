import { mockWorkspaceClient } from "./mock-workspace-client";
import { RpcWorkspaceClient } from "./rpc-workspace-client";
import type { WorkspaceClient } from "./workspace-client";

const env = import.meta.env as {
    readonly VITE_FORMA_DATA_SOURCE?: string;
    readonly VITE_FORMA_RPC_ENDPOINT?: string;
};
const dataSource = env.VITE_FORMA_DATA_SOURCE;
const rpcEndpoint = env.VITE_FORMA_RPC_ENDPOINT;

export const workspaceClient: WorkspaceClient =
    dataSource === "mock"
        ? mockWorkspaceClient
        : dataSource === "rpc"
          ? new RpcWorkspaceClient(rpcEndpoint)
          : fallbackWorkspaceClient(new RpcWorkspaceClient(rpcEndpoint), mockWorkspaceClient);

function fallbackWorkspaceClient(primary: WorkspaceClient, fallback: WorkspaceClient): WorkspaceClient {
    return {
        async getDashboard() {
            try {
                return await primary.getDashboard();
            } catch (error) {
                console.warn("Falling back to mock workspace dashboard.", error);
                return fallback.getDashboard();
            }
        },
        async getDocument(documentId) {
            try {
                return await primary.getDocument(documentId);
            } catch (error) {
                console.warn("Falling back to mock workspace document.", error);
                try {
                    return await fallback.getDocument(documentId);
                } catch {
                    throw error;
                }
            }
        },
        async getViewProjection(viewId) {
            try {
                return await primary.getViewProjection(viewId);
            } catch (error) {
                console.warn("Falling back to mock workspace view projection.", error);
                try {
                    return await fallback.getViewProjection(viewId);
                } catch {
                    throw error;
                }
            }
        },
    };
}
