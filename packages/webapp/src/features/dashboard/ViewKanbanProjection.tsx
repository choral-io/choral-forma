import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { DashboardViewProjection, DashboardViewProjectionItem } from "@/data/workspace-client";
import { cn } from "@/lib/utils";

import { syncKanbanStickyRailGeometry, syncKanbanStickyRailScroll } from "./kanban-sticky-header";
import {
    createProjectionStickyBoundaryController,
    projectionStickyHeaderClassName,
    projectionStickyHeaderSurfaceClassName,
} from "./projection-sticky-boundary";
import { formattedViewFieldValue, viewFieldLabel } from "./view-field-value";

export function ViewKanbanProjection({
    projection,
}: {
    projection: Extract<DashboardViewProjection, { kind: "kanban" }>;
}) {
    const boundaryRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const sourceRef = useRef<HTMLDivElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const boundary = boundaryRef.current;
        const scroll = scrollRef.current;
        const source = sourceRef.current;
        const stickyHeader = stickyHeaderRef.current;
        if (!boundary || !scroll || !source || !stickyHeader) return;
        const sources = [...boundary.querySelectorAll<HTMLElement>("[data-view-kanban-column-heading]")];
        const stickyColumns = [...stickyHeader.querySelectorAll<HTMLElement>("[data-view-kanban-sticky-column]")];

        return createProjectionStickyBoundaryController({
            boundary,
            observe: [scroll, ...boundary.querySelectorAll("[data-view-kanban-column]"), ...sources],
            source,
            sticky: stickyHeader,
            syncPresentation: () => {
                syncKanbanStickyRailGeometry({
                    scrollLeft: scroll.scrollLeft,
                    sources,
                    stickyColumns,
                    stickyRail: stickyHeader,
                });
            },
        });
    }, [projection]);

    return (
        <div className="relative grid" ref={boundaryRef}>
            <div
                aria-hidden="true"
                className={cn(projectionStickyHeaderClassName, "rounded-none border-0 bg-transparent")}
                data-view-kanban-sticky-header=""
                ref={stickyHeaderRef}
            >
                <div className={kanbanTrackClassName}>
                    {projection.columns.map((column) => (
                        <div
                            className={cn(
                                kanbanColumnClassName,
                                kanbanColumnHeaderBoxClassName,
                                projectionStickyHeaderSurfaceClassName,
                                "bg-base-200 ring-base-300 ring-1 ring-inset",
                            )}
                            data-view-kanban-sticky-column=""
                            key={column.id}
                        >
                            <div className={kanbanColumnHeadingClassName}>
                                <h3 className="min-w-0 truncate font-medium">
                                    {column.icon ? <span aria-hidden="true">{column.icon} </span> : null}
                                    {column.label}
                                </h3>
                                <span className="badge badge-ghost badge-sm shrink-0">{column.items.length}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div
                aria-label="Kanban board"
                className="focus-visible:ring-primary/40 col-start-1 row-start-1 max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-3 outline-none focus-visible:ring-3"
                data-view-kanban-scroll=""
                onScroll={(event) => {
                    syncKanbanStickyRailScroll(stickyHeaderRef.current, event.currentTarget.scrollLeft);
                }}
                ref={scrollRef}
                role="region"
                tabIndex={0}
            >
                <div className={kanbanTrackClassName}>
                    {projection.columns.map((column, index) => (
                        <section
                            className={cn(
                                kanbanColumnClassName,
                                "border-base-300 bg-base-200 min-h-60 rounded-lg border",
                            )}
                            data-view-kanban-column=""
                            key={column.id}
                        >
                            <div
                                className={kanbanColumnHeaderBoxClassName}
                                data-view-kanban-column-heading=""
                                ref={index === 0 ? sourceRef : undefined}
                            >
                                <div className={kanbanColumnHeadingClassName}>
                                    <h3 className="min-w-0 truncate font-medium" title={column.label}>
                                        {column.icon ? <span aria-hidden="true">{column.icon} </span> : null}
                                        {column.label}
                                    </h3>
                                    <span className="badge badge-ghost badge-sm shrink-0">{column.items.length}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 px-3 pb-3">
                                {column.items.map((item) => (
                                    <ViewKanbanCard card={projection.card} item={item} key={item.path} />
                                ))}
                                {column.items.length === 0 ? (
                                    <p className="border-base-300 text-base-content/60 rounded-md border border-dashed p-3 text-sm">
                                        No entries
                                    </p>
                                ) : null}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

const kanbanTrackClassName = "flex min-w-max flex-nowrap items-start gap-3";
const kanbanColumnClassName = "w-[min(20rem,85vw)] flex-none";
const kanbanColumnHeaderBoxClassName = "p-3";
const kanbanColumnHeadingClassName = "flex items-center justify-between gap-3";

function ViewKanbanCard({
    card,
    item,
}: {
    card: Extract<DashboardViewProjection, { kind: "kanban" }>["card"];
    item: DashboardViewProjectionItem;
}) {
    const title = formattedViewFieldValue(item, card.titleField) || item.title || item.path;
    const subtitles = card.subtitleFields
        .map((field) => ({ field, value: formattedViewFieldValue(item, field) }))
        .filter(({ value }) => value !== "");
    const badges = card.badgeFields
        .map((field) => ({ field, value: formattedViewFieldValue(item, field) }))
        .filter(({ value }) => value !== "");
    const content = (
        <div className="card-body gap-2 p-3">
            <span className="card-title block truncate text-base" title={title}>
                {title}
            </span>
            {subtitles.length > 0 ? (
                <div className="grid gap-1">
                    {subtitles.map(({ field, value }) => (
                        <p className="text-base-content/60 line-clamp-2 text-sm" key={field} title={value}>
                            <span className="sr-only">{viewFieldLabel(field)}: </span>
                            {value}
                        </p>
                    ))}
                </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
                {badges.map(({ field, value }) => (
                    <span
                        className="badge badge-soft badge-sm max-w-full"
                        key={field}
                        title={`${viewFieldLabel(field)}: ${value}`}
                    >
                        <span className="sr-only">{viewFieldLabel(field)}: </span>
                        <span className="truncate">{value}</span>
                    </span>
                ))}
            </div>
        </div>
    );

    if (!item.routePath) {
        return (
            <article className="card card-sm card-border border-base-300 bg-base-100 overflow-hidden">
                {content}
            </article>
        );
    }

    return (
        <Link
            className="card card-sm card-border border-base-300 bg-base-100 hover:bg-base-300 focus-visible:ring-primary/50 overflow-hidden transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}
