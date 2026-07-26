import type { CSSProperties } from "react";

import { normalizedTableColumnLength } from "@choral-forma/shared";

import type { DashboardViewColumn } from "@/data/workspace-client";

function comparableLengths(minimum: string | undefined, maximum: string | undefined): [number, number] | undefined {
    if (!minimum || !maximum) return undefined;
    const unit = ["rem", "px", "em"].find((candidate) => minimum.endsWith(candidate) && maximum.endsWith(candidate));
    return unit ? [Number.parseFloat(minimum), Number.parseFloat(maximum)] : undefined;
}

export function tableColumnStyle(column: DashboardViewColumn): CSSProperties | undefined {
    const width = normalizedTableColumnLength(column.width);
    let minWidth = normalizedTableColumnLength(column.minWidth);
    let maxWidth = normalizedTableColumnLength(column.maxWidth);
    const comparable = comparableLengths(minWidth, maxWidth);
    if (comparable && comparable[0] > comparable[1]) {
        minWidth = undefined;
        maxWidth = undefined;
    }
    if (width === undefined && minWidth === undefined && maxWidth === undefined) return undefined;
    return { width, minWidth, maxWidth };
}

export function tableColumnWraps(column: DashboardViewColumn): boolean {
    return column.overflow === "wrap";
}
