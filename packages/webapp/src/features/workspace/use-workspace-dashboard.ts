import { useOutletContext } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";

export function useWorkspaceDashboard() {
    return useOutletContext<WorkspaceDashboard>();
}
