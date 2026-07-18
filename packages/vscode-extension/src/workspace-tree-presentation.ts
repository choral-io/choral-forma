import { isSupportedDisplayIcon } from "@choral-forma/shared";

import type { FormaTreeNode } from "./workspace-tree-model.ts";

export type TreeNodePresentation = {
    icon: string;
};

export function viewIconName(kind: string): string {
    switch (kind) {
        case "list":
            return "list";
        case "table":
            return "table-properties";
        case "kanban":
            return "kanban";
        case "graph":
            return "network";
        default:
            return "eye";
    }
}

export function treeNodePresentation(node: FormaTreeNode): TreeNodePresentation {
    switch (node.type) {
        case "loadMore":
            return { icon: "ellipsis" };
        case "taxonomy":
            return configuredPresentation(node.value.display, "tags");
        case "term":
            return node.value.status === "passed"
                ? configuredPresentation(node.value.display, "folder")
                : { icon: "triangle-alert" };
        case "views":
            return { icon: "panels-top-left" };
        case "view":
            return { icon: viewIconName(node.value.kind) };
        case "entry":
            return { icon: "file-text" };
    }
}

function configuredPresentation(display: { icon?: string } | undefined, fallbackIcon: string): TreeNodePresentation {
    const icon = display?.icon && isSupportedDisplayIcon(display.icon) ? display.icon : fallbackIcon;
    return { icon };
}
