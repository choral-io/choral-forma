import type { DashboardViewProjection } from "@/data/workspace-client";
import { ganttDependencySummary, ganttRowLabel, type GanttNode } from "@choral-forma/shared";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { dateInZone } from "./calendar-layout";
import {
    DAY_WIDTHS,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    TITLE_WIDTH,
    dayIndex,
    dayTicks,
    extendRange,
    initialRange,
    jumpDay,
    monthBands,
    rangeForAnchor,
    windowIndices,
} from "./gantt-layout";
import { positionMonthLabels } from "./gantt-month-labels";

type Projection = Extract<DashboardViewProjection, { kind: "gantt" }>;
function EntryLink({ node, routes }: { node: GanttNode; routes: Projection["routes"] }) {
    const route = routes[node.path];
    return route ? (
        <Link className="link link-hover" to={route}>
            {node.title}
        </Link>
    ) : (
        <span>{node.title}</span>
    );
}
const CompleteList = memo(function CompleteList({ projection, locale }: { projection: Projection; locale: string }) {
    const nodes = new Map(projection.nodes.map((node) => [node.path, node]));
    const rows = new Map(projection.rows.map((row) => [row.path, row]));
    return (
        <ul className="space-y-4">
            {projection.nodes.map((node) => {
                const row = rows.get(node.path);
                return (
                    <li key={node.path} className="border-base-300 border-b pb-3">
                        <EntryLink node={node} routes={projection.routes} />
                        <p className="text-base-content/70 text-sm">
                            {row
                                ? ganttRowLabel(row, projection.timeZone, locale)
                                : node.status === "invalid"
                                  ? "Invalid interval"
                                  : "Unscheduled"}
                        </p>
                        {node.classification && <p className="text-sm">{node.classification.label}</p>}
                        <p className="mt-2 text-sm">Predecessors · finish to start</p>
                        <ul className="list-inside list-disc text-sm">
                            {node.dependencies.predecessors.map((path) => {
                                const target = nodes.get(path);
                                return target ? (
                                    <li key={path}>
                                        <EntryLink node={target} routes={projection.routes} />
                                    </li>
                                ) : null;
                            })}
                        </ul>
                        <p className="text-base-content/60 text-xs">{ganttDependencySummary(node.dependencies)}</p>
                    </li>
                );
            })}
        </ul>
    );
});

export function ViewGanttProjection({ projection }: { projection: Projection }) {
    const locale = navigator.language || (projection.canonicalLanguage ?? "en");
    const [today] = useState(() => dateInZone(new Date(), projection.timeZone));
    const initial = useMemo(() => initialRange(projection.rows, today), [projection.rows, today]);
    const [range, setRange] = useState(initial.range);
    const [width, setWidth] = useState(initial.width);
    const [message, setMessage] = useState("");
    const [clamped, setClamped] = useState(false);
    const [listOpen, setListOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [viewport, setViewport] = useState({ left: 0, top: 0, width: 800, height: 500 });
    const scrollerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef<number | undefined>(undefined);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const acceptedJumpRef = useRef(today);
    const id = useId();
    const nodes = useMemo(() => new Map(projection.nodes.map((node) => [node.path, node])), [projection.nodes]);
    const positions = useMemo(
        () => new Map(projection.rows.map((row, index) => [row.path, { row, index }])),
        [projection.rows],
    );
    const rowWindow = windowIndices(
        Math.max(0, viewport.top - HEADER_HEIGHT),
        viewport.height,
        ROW_HEIGHT,
        projection.rows.length,
    );
    const columns = range.end - range.start;
    const dayWindow = windowIndices(viewport.left, Math.max(0, viewport.width - TITLE_WIDTH), width, columns);
    const available = initial.available && !clamped;
    const rowIndices = Array.from({ length: rowWindow.end - rowWindow.start }, (_, i) => rowWindow.start + i);
    if (projection.rows.length && !rowIndices.includes(active)) rowIndices.push(active);
    const selected = projection.rows[active];
    const selectedNode = selected ? nodes.get(selected.path) : undefined;
    const selectedEdges = useMemo(
        () =>
            projection.edges.filter(
                (edge) => edge.status === "anchored" && (edge.from === selected?.path || edge.to === selected?.path),
            ),
        [projection.edges, selected?.path],
    );
    const label = (row: Projection["rows"][number]) => ganttRowLabel(row, projection.timeZone, locale);
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
    const style = {
        "--gantt-origin": range.start,
        "--gantt-day": `${String(width)}px`,
        "--gantt-rule":
            width < 28 ? "color-mix(in oklab, var(--color-base-300) 35%, transparent)" : "var(--color-base-300)",
        "width": columns * width + TITLE_WIDTH,
        "height": projection.rows.length * ROW_HEIGHT + HEADER_HEIGHT,
    } as CSSProperties;

    useEffect(() => {
        const element = scrollerRef.current;
        if (!element) return;
        const observer = new ResizeObserver(() => {
            setViewport({
                left: element.scrollLeft,
                top: element.scrollTop,
                width: element.clientWidth,
                height: element.clientHeight,
            });
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [available]);
    useLayoutEffect(() => {
        const element = scrollerRef.current;
        if (element && pendingScrollRef.current !== undefined) {
            element.scrollLeft = pendingScrollRef.current;
            pendingScrollRef.current = undefined;
        }
        const content = trackRef.current;
        if (
            content &&
            (Math.abs(content.offsetWidth - (columns * width + TITLE_WIDTH)) > 1 ||
                Math.abs(content.offsetHeight - (projection.rows.length * ROW_HEIGHT + HEADER_HEIGHT)) > 1)
        ) {
            // Geometry can only be validated after layout; fall back before displaying a distorted track.
            setClamped(true);
        }
    }, [columns, width, range, projection.rows.length]);

    // Run after pending scroll compensation and whenever React mounts new bands.
    useLayoutEffect(() => {
        if (scrollerRef.current) positionMonthLabels(scrollerRef.current);
    }, [available, range, width, dayWindow.start, dayWindow.end, viewport.width]);
    useEffect(() => {
        const element = scrollerRef.current;
        if (!element) return;
        let frame: number | undefined;
        const schedule = () => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
                frame = undefined;
                positionMonthLabels(element);
            });
        };
        element.addEventListener("scroll", schedule, { passive: true });
        const observer = new ResizeObserver(schedule);
        observer.observe(element);
        return () => {
            element.removeEventListener("scroll", schedule);
            observer.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    }, [available]);

    function jumpTo(value: string) {
        const day = jumpDay(value);
        if (day === undefined) {
            setMessage("Choose a date from 0001-01-01 through 9999-12-30.");
            return false;
        }
        const next = rangeForAnchor(range, day, width, viewport.width, projection.rows.length);
        if (!next) {
            setMessage(
                "That jump exceeds the timeline size limit. Choose a smaller day width or use the complete list.",
            );
            return false;
        }
        pendingScrollRef.current = (day - next.start) * width;
        setRange(next);
        acceptedJumpRef.current = value;
        if (dateInputRef.current) dateInputRef.current.value = value;
        setMessage("");
        return true;
    }
    function moveRow(index: number) {
        const next = Math.max(0, Math.min(projection.rows.length - 1, index));
        setActive(next);
        const element = scrollerRef.current;
        if (!element) return;
        const top = next * ROW_HEIGHT;
        if (top < element.scrollTop) element.scrollTop = top;
        else if (top + ROW_HEIGHT + HEADER_HEIGHT > element.scrollTop + element.clientHeight)
            element.scrollTop = top + ROW_HEIGHT + HEADER_HEIGHT - element.clientHeight;
        setViewport((v) => ({ ...v, top: element.scrollTop }));
    }
    return (
        <section aria-label="Gantt" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!available || !projection.rows.length}
                        onClick={() => {
                            jumpTo(dateInZone(new Date(), projection.timeZone));
                        }}
                    >
                        Today
                    </button>
                    <form
                        noValidate
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const input = event.currentTarget.elements.namedItem("date") as HTMLInputElement;
                            if (!jumpTo(input.value)) input.value = acceptedJumpRef.current;
                        }}
                    >
                        <input
                            ref={dateInputRef}
                            name="date"
                            aria-label="Jump to date"
                            type="date"
                            min="0001-01-01"
                            max="9999-12-30"
                            defaultValue={today}
                            className="input input-sm w-40"
                            disabled={!available || !projection.rows.length}
                            required
                        />
                        <button className="btn btn-sm" disabled={!available || !projection.rows.length}>
                            Go
                        </button>
                    </form>
                    <select
                        aria-label="Day width"
                        className="select select-sm w-28"
                        value={width}
                        disabled={!available || !projection.rows.length}
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            const anchor = range.start + (scrollerRef.current?.scrollLeft ?? 0) / width;
                            const nextRange = rangeForAnchor(
                                range,
                                anchor,
                                next,
                                viewport.width,
                                projection.rows.length,
                            );
                            if (!nextRange) {
                                setMessage(
                                    "That day width exceeds the timeline size limit; the previous width is retained.",
                                );
                                return;
                            }
                            pendingScrollRef.current = ((scrollerRef.current?.scrollLeft ?? 0) / width) * next;
                            setRange(nextRange);
                            setWidth(next);
                            setMessage("");
                        }}
                    >
                        {DAY_WIDTHS.map((value) => (
                            <option key={value} value={value}>
                                {value} px / day
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <p className="text-base-content/70 text-sm">
                {projection.counts.scheduled} scheduled · {projection.counts.unscheduled} unscheduled ·{" "}
                {projection.counts.invalid} invalid · {projection.timeZone}
            </p>
            <p role="status" className={message ? "text-base-content/70 text-sm" : "sr-only"}>
                {message}
            </p>
            {!available ? (
                <p>
                    Timeline unavailable: its complete extent exceeds the supported layout size. All entries remain
                    available below.
                </p>
            ) : !projection.rows.length ? (
                <p>No scheduled entries. See the complete list for unscheduled or invalid entries.</p>
            ) : (
                <div
                    ref={scrollerRef}
                    role="grid"
                    aria-label="Gantt timeline"
                    aria-rowcount={projection.rows.length + 1}
                    aria-colcount={2}
                    aria-activedescendant={`${id}-row-${String(active)}`}
                    tabIndex={0}
                    data-gantt-timeline=""
                    className="border-base-300 relative h-[min(65vh,40rem)] min-h-64 overflow-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2"
                    onKeyDown={(event) => {
                        const movements: Record<string, number> = {
                            ArrowDown: active + 1,
                            ArrowUp: active - 1,
                            PageDown: active + Math.max(1, Math.floor(viewport.height / ROW_HEIGHT) - 1),
                            PageUp: active - Math.max(1, Math.floor(viewport.height / ROW_HEIGHT) - 1),
                            Home: 0,
                            End: projection.rows.length - 1,
                        };
                        if (event.target === event.currentTarget && event.key in movements) {
                            event.preventDefault();
                            moveRow(movements[event.key] ?? active);
                        }
                    }}
                    onScroll={(event) => {
                        const element = event.currentTarget;
                        const horizontalChanged = element.scrollLeft !== viewport.left;
                        setViewport({
                            left: element.scrollLeft,
                            top: element.scrollTop,
                            width: element.clientWidth,
                            height: element.clientHeight,
                        });
                        // Vertical navigation must not extend the horizontal range.
                        if (!horizontalChanged) return;
                        const side =
                            element.scrollLeft < width * 2
                                ? "left"
                                : element.scrollLeft + element.clientWidth > element.scrollWidth - width * 2
                                  ? "right"
                                  : undefined;
                        if (!side || pendingScrollRef.current !== undefined) return;
                        const next = extendRange(range, side, width);
                        if (next.start === range.start && next.end === range.end) {
                            setMessage("Timeline boundary reached. Use the complete list for all entries.");
                            return;
                        }
                        if (side === "left")
                            pendingScrollRef.current = element.scrollLeft + (range.start - next.start) * width;
                        setRange(next);
                    }}
                >
                    <div ref={trackRef} style={style} className="relative">
                        <div
                            role="row"
                            aria-rowindex={1}
                            className="bg-base-100 border-base-300 sticky top-0 z-20 flex border-b"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            <div
                                role="columnheader"
                                className="bg-base-100 border-base-300 sticky left-0 z-10 shrink-0 border-r p-3 font-medium"
                                style={{ width: TITLE_WIDTH }}
                            >
                                Entry
                            </div>
                            <div role="columnheader" aria-label="Calendar days" className="relative flex-1">
                                {monthBands(range, dayWindow).map((month) => {
                                    const start = (month.start - range.start) * width;
                                    const end = (month.end - range.start) * width;
                                    const monthLabel = monthFormatter.format(new Date(`${month.key}-01T00:00:00Z`));
                                    return (
                                        <div
                                            key={month.key}
                                            className="bg-base-200 border-base-300 absolute top-0 h-8 border-r border-b text-center"
                                            style={{ left: start, width: end - start }}
                                        >
                                            <span
                                                className="absolute top-0 left-0 flex h-full items-center justify-center overflow-hidden px-1 text-xs font-medium"
                                                data-gantt-month-start={start}
                                                data-gantt-month-end={end}
                                                title={monthLabel}
                                            >
                                                <span className="truncate">{monthLabel}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                                {dayTicks(range, dayWindow, width).map((tick) => (
                                    <div
                                        key={tick.day}
                                        aria-hidden="true"
                                        className="border-base-300/50 absolute bottom-0 h-7 border-l text-center text-xs"
                                        style={{ left: (tick.day - range.start) * width, width: tick.width }}
                                    >
                                        <span
                                            className={
                                                width >= 28 ? "absolute inset-x-0 bottom-2" : "absolute bottom-2 left-1"
                                            }
                                        >
                                            {tick.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {rowIndices.map((index) => {
                            const row = projection.rows[index];
                            if (!row) return null;
                            const node = nodes.get(row.path);
                            if (!node) return null;
                            const first = dayIndex(row.firstDate);
                            const duration = dayIndex(row.afterLastDate) - first;
                            const color = node.classification?.color;
                            const validColor = color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
                            return (
                                <div
                                    key={row.path}
                                    id={`${id}-row-${String(index)}`}
                                    role="row"
                                    aria-rowindex={index + 2}
                                    aria-selected={active === index}
                                    className={`border-base-300/50 absolute flex w-full border-b ${active === index ? "bg-base-200" : "bg-base-100"}`}
                                    style={{ top: HEADER_HEIGHT + index * ROW_HEIGHT, height: ROW_HEIGHT }}
                                >
                                    <div
                                        role="rowheader"
                                        className={`border-base-300 sticky left-0 z-10 flex shrink-0 items-center border-r px-2 ${active === index ? "bg-base-200 font-medium" : "bg-base-100"}`}
                                        style={{ width: TITLE_WIDTH }}
                                    >
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            className="size-full cursor-pointer truncate text-left text-sm hover:underline"
                                            title={node.title}
                                            onClick={() => {
                                                setActive(index);
                                                scrollerRef.current?.focus({ preventScroll: true });
                                            }}
                                        >
                                            {node.title}
                                        </button>
                                    </div>
                                    <div
                                        role="gridcell"
                                        aria-label={`${node.title}: ${label(row)}`}
                                        className="relative flex-1"
                                        style={{
                                            backgroundImage:
                                                "repeating-linear-gradient(to right, var(--gantt-rule) 0, var(--gantt-rule) 1px, transparent 1px, transparent var(--gantt-day))",
                                        }}
                                    >
                                        <div
                                            aria-hidden="true"
                                            className="bg-base-300 border-base-content/30 absolute top-2 h-5 rounded-sm border border-l-2"
                                            style={{
                                                left: `calc((${String(first)} - var(--gantt-origin)) * var(--gantt-day))`,
                                                width: `calc(${String(duration)} * var(--gantt-day))`,
                                                borderLeftColor: validColor,
                                            }}
                                        />
                                        {(row.milestone ||
                                            (row.temporal.kind === "datetime" &&
                                                row.temporal.endExclusive === null)) && (
                                            <span
                                                aria-hidden="true"
                                                className="text-base-content absolute top-1 text-lg"
                                                style={{
                                                    left: `calc((${String(first)} - var(--gantt-origin)) * var(--gantt-day))`,
                                                }}
                                            >
                                                ◆
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute top-0"
                            style={{ left: TITLE_WIDTH }}
                            width={columns * width}
                            height={projection.rows.length * ROW_HEIGHT + HEADER_HEIGHT}
                        >
                            {selectedEdges.map((edge) => {
                                const from = positions.get(edge.from);
                                const to = positions.get(edge.to);
                                if (
                                    !from ||
                                    !to ||
                                    [from.index, to.index].some(
                                        (index) => index < rowWindow.start || index >= rowWindow.end,
                                    )
                                )
                                    return null;
                                const x1 = (dayIndex(from.row.afterLastDate) - range.start) * width;
                                const x2 = (dayIndex(to.row.firstDate) - range.start) * width;
                                const y1 = HEADER_HEIGHT + (from.index + 0.5) * ROW_HEIGHT;
                                const y2 = HEADER_HEIGHT + (to.index + 0.5) * ROW_HEIGHT;
                                return (
                                    <path
                                        key={edge.id}
                                        d={`M ${String(x1)} ${String(y1)} H ${String(x1 + 8)} V ${String(y2)} H ${String(x2)}`}
                                        fill="none"
                                        stroke="currentColor"
                                        className="text-base-content/60"
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </div>
            )}
            {selectedNode && (
                <div className="text-sm">
                    <EntryLink node={selectedNode} routes={projection.routes} />
                    <p>{selected ? label(selected) : ""}</p>
                    <p>Predecessors · finish to start</p>
                    <ul className="list-inside list-disc">
                        {selectedNode.dependencies.predecessors.map((path) => {
                            const node = nodes.get(path);
                            return node ? (
                                <li key={path}>
                                    <EntryLink node={node} routes={projection.routes} />
                                </li>
                            ) : null;
                        })}
                    </ul>
                    <p className="text-base-content/60">{ganttDependencySummary(selectedNode.dependencies)}</p>
                </div>
            )}
            <p className="text-base-content/60 text-xs">
                Dependencies describe the selected graph only. No scheduling conflicts are computed. Use arrow, page,
                Home and End keys in the timeline to select entries.
            </p>
            <details
                className="collapse-arrow border-base-300 collapse border"
                onToggle={(event) => {
                    setListOpen(event.currentTarget.open);
                }}
            >
                <summary className="collapse-title font-medium">
                    Complete list · {projection.nodes.length} entries
                </summary>
                <div className="collapse-content">
                    {listOpen && <CompleteList projection={projection} locale={locale} />}
                </div>
            </details>
        </section>
    );
}
