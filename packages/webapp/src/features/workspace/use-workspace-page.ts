import { createContext, use } from "react";

import type { WorkspacePageRead } from "@/data/workspace-page-read";

export const WorkspacePageContext = createContext<WorkspacePageRead>({});

export function useWorkspacePage() {
    return use(WorkspacePageContext);
}
