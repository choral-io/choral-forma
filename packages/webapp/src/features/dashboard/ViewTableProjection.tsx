import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type {
    DashboardViewFieldValue,
    DashboardViewProjection,
    DashboardViewProjectionItem,
} from "@/data/workspace-client";
import {
    tableColumnEntryRoute,
    tableColumnStyle,
    tableColumnWraps,
} from "@/features/dashboard/table-column-presentation";
import { cn } from "@/lib/utils";

import {
    createProjectionStickyBoundaryController,
    projectionStickyHeaderClassName,
} from "./projection-sticky-boundary";
import { isReferenceViewField, isValueViewField, plainViewFieldValue, rawViewFieldValue } from "./view-field-value";

export function ViewTableProjection({
    projection,
}: {
    projection: Extract<DashboardViewProjection, { kind: "table" }>;
}) {
    const boundaryRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLTableSectionElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const stickyTableRef = useRef<HTMLTableElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const columns = projection.columns.map((column) => ({
        column,
        headerClassName: cn(
            "font-medium",
            tableColumnWraps(column) ? "wrap-break-word whitespace-normal" : "whitespace-nowrap",
        ),
        style: tableColumnStyle(column),
    }));

    useEffect(() => {
        const boundary = boundaryRef.current;
        const header = headerRef.current;
        const scroll = scrollRef.current;
        const stickyHeader = stickyHeaderRef.current;
        const stickyTable = stickyTableRef.current;
        const table = tableRef.current;
        if (!boundary || !header || !scroll || !stickyHeader || !stickyTable || !table) return;

        return createProjectionStickyBoundaryController({
            boundary,
            observe: [table, ...header.querySelectorAll("th")],
            source: header,
            sticky: stickyHeader,
            syncPresentation: () => {
                syncTableStickyHeaderGeometry({ header, scroll, stickyHeader, stickyTable, table });
            },
        });
    }, [projection]);

    return (
        <div className="relative grid" ref={boundaryRef}>
            <div
                aria-hidden="true"
                className={projectionStickyHeaderClassName}
                data-view-sticky-header=""
                ref={stickyHeaderRef}
            >
                <table className="table-sm table min-w-0 table-fixed" ref={stickyTableRef}>
                    <colgroup>
                        {columns.map(({ column }) => (
                            <col key={column.field} />
                        ))}
                    </colgroup>
                    <thead className="bg-base-200 text-base-content/60">
                        <tr className="border-base-300 border-b">
                            {columns.map(({ column, headerClassName }) => (
                                <th className={headerClassName} key={column.field}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                </table>
            </div>
            <div className="border-base-300 col-start-1 row-start-1 overflow-hidden rounded-lg border">
                <div
                    aria-label="Table view"
                    className="focus-visible:ring-primary/40 overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-3"
                    data-view-table-scroll=""
                    onScroll={(event) => {
                        if (stickyHeaderRef.current)
                            stickyHeaderRef.current.scrollLeft = event.currentTarget.scrollLeft;
                    }}
                    ref={scrollRef}
                    role="region"
                    tabIndex={0}
                >
                    <table className="table-sm table min-w-max" ref={tableRef}>
                        <thead className="bg-base-200 text-base-content/60" ref={headerRef}>
                            <tr className="border-base-300 border-b">
                                {columns.map(({ column, headerClassName, style }) => (
                                    <th className={headerClassName} key={column.field} scope="col" style={style}>
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {projection.items.map((item) => (
                                <tr
                                    className="border-base-300 hover:bg-base-200/50 border-b last:border-b-0"
                                    key={item.path}
                                >
                                    {columns.map(({ column, style }) => (
                                        <td
                                            className={cn("align-top", style ? null : "max-w-80")}
                                            key={`${item.path}-${column.field}`}
                                            style={style}
                                        >
                                            <ViewProjectionCell column={column} item={item} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function syncTableStickyHeaderGeometry({
    header,
    scroll,
    stickyHeader,
    stickyTable,
    table,
}: {
    header: HTMLTableSectionElement;
    scroll: HTMLDivElement;
    stickyHeader: HTMLDivElement;
    stickyTable: HTMLTableElement;
    table: HTMLTableElement;
}) {
    const headerCells = header.querySelectorAll("th");
    const stickyColumns = stickyTable.querySelectorAll("col");
    headerCells.forEach((cell, index) => {
        const stickyColumn = stickyColumns.item(index);
        stickyColumn.style.width = `${cell.getBoundingClientRect().width.toString()}px`;
    });
    stickyTable.style.width = `${table.getBoundingClientRect().width.toString()}px`;
    stickyHeader.scrollLeft = scroll.scrollLeft;
}

function ViewProjectionCell({
    column,
    item,
}: {
    column: Extract<DashboardViewProjection, { kind: "table" }>["columns"][number];
    item: DashboardViewProjectionItem;
}) {
    const value = rawViewFieldValue(item, column.field);

    if (value === undefined || value === null || plainViewFieldValue(value) === "") {
        return <span className="text-base-content/50">—</span>;
    }

    if (isReferenceViewField(value)) {
        return <ViewReferenceFieldContent column={column} value={value} />;
    }

    const rawValue = isValueViewField(value) ? value.value : value;
    const routePath = tableColumnEntryRoute(column, item);
    const textClassName = routePath ? "text-primary" : "text-base-content/70";
    const content = Array.isArray(rawValue) ? (
        <ul className="space-y-1">
            {rawValue.map((entry, index) => {
                const label = plainViewFieldValue(entry);
                return (
                    <li
                        className={cn(
                            textClassName,
                            tableColumnWraps(column) ? "wrap-break-word whitespace-normal" : "max-w-72 truncate",
                        )}
                        key={`${label}-${String(index)}`}
                        title={label}
                    >
                        {label}
                    </li>
                );
            })}
        </ul>
    ) : (
        <span
            className={cn(
                textClassName,
                "block",
                tableColumnWraps(column) ? "wrap-break-word whitespace-normal" : "max-w-80 truncate",
            )}
            title={plainViewFieldValue(rawValue)}
        >
            {plainViewFieldValue(rawValue)}
        </span>
    );

    if (!routePath) return content;

    return (
        <Link
            aria-label={`Open source entry ${item.title}`}
            className="link link-primary link-hover block"
            to={routePath}
        >
            {content}
        </Link>
    );
}

function ViewReferenceFieldContent({
    column,
    value,
}: {
    column: Extract<DashboardViewProjection, { kind: "table" }>["columns"][number];
    value: Extract<DashboardViewFieldValue, { kind: "reference" | "referenceList" }>;
}) {
    const references = value.kind === "reference" ? [value.reference] : value.references;
    const referenceLink = (reference: (typeof references)[number]) => {
        const className = cn(
            "link link-primary link-hover",
            tableColumnWraps(column) ? "wrap-break-word whitespace-normal" : "block max-w-72 truncate",
        );
        return reference.routePath ? (
            <Link className={className} key={reference.path} title={reference.title} to={reference.routePath}>
                {reference.title}
            </Link>
        ) : (
            <span className={className} key={reference.path} title={reference.title}>
                {reference.title}
            </span>
        );
    };

    return value.kind === "reference" ? (
        referenceLink(value.reference)
    ) : (
        <ul className="space-y-1">
            {references.map((reference) => (
                <li key={reference.path}>{referenceLink(reference)}</li>
            ))}
        </ul>
    );
}
