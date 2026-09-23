import type { DashboardViewProjection } from "@/data/workspace-client";
import { ganttDependencySummary, ganttProgressLabel, ganttRowLabel, type GanttNode } from "@choral-forma/shared";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { dateInZone } from "./calendar-layout";
import { clipConnectors } from "./gantt-connector-clip";
import {
    ALL_EDGES_MAX_ROWS,
    CONNECTOR_LANES,
    CONNECTOR_LANE_STEP,
    DAY_WIDTHS,
    FIRST_DAY,
    HEADER_HEIGHT,
    LOCATE_LEAD_COLUMNS,
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
                            {ganttProgressLabel(node.progress)}
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
    // Small enough to read every thread; above that, only the selected row's, or
    // the view fills with lines joining points that cannot share a screen.
    const allEdgesReadable = projection.rows.length <= ALL_EDGES_MAX_ROWS;
    // Lane per edge over every anchored edge rather than the drawn subset, so
    // selecting a row cannot move a connector that was already on screen.
    const connectorLane = useMemo(() => {
        const used = new Map<string, number>();
        const lanes = new Map<string, number>();
        for (const edge of projection.edges) {
            if (edge.status !== "anchored") continue;
            const next = used.get(edge.from) ?? 0;
            lanes.set(edge.id, next % CONNECTOR_LANES);
            used.set(edge.from, next + 1);
        }
        return lanes;
    }, [projection.edges]);
    const selectedEdges = useMemo(
        () =>
            projection.edges.filter(
                (edge) =>
                    edge.status === "anchored" &&
                    (allEdgesReadable || edge.from === selected?.path || edge.to === selected?.path),
            ),
        [projection.edges, selected?.path, allEdgesReadable],
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
        if (!scrollerRef.current) return;
        positionMonthLabels(scrollerRef.current);
        clipConnectors(scrollerRef.current);
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
                clipConnectors(element);
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

    /**
     * The observed width lags a layout change until the observer or a scroll
     * fires, and reserving track against a stale, smaller width leaves too
     * little of it. Anything that has to land on an exact offset measures now;
     * only the render window, which the observer already drives, reads state.
     */
    const trackWidth = () => scrollerRef.current?.clientWidth ?? viewport.width;
    function jumpTo(value: string) {
        const day = jumpDay(value);
        if (day === undefined) {
            setMessage("Choose a date from 0001-01-01 through 9999-12-30.");
            return false;
        }
        const next = rangeForAnchor(range, day, width, trackWidth(), projection.rows.length);
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
    /**
     * Put a row's bar head at a predictable place, on Enter or a double-click.
     *
     * Unconditional: a partly visible bar still moves, so the gesture always
     * does the same thing. It is deliberately not attached to selection, which
     * single-click and keyboard traversal both perform and which must be able
     * to happen without the viewport moving. The lead-in is counted in columns,
     * so the bar head lands two days in regardless of day width.
     *
     * The range is widened before the offset is applied. Writing `scrollLeft`
     * past the current track only moves as far as the track reaches, and the
     * clamped write leaves the offset unchanged, so the scroll handler's
     * edge extension never fires and repeating the gesture cannot recover.
     * Anchoring on the lead-in column reserves both the columns before the bar
     * and a viewport of track after it, which is what makes one gesture enough.
     *
     * Both axes move, for the same reason: the row is centred under the sticky
     * header rather than nudged to the nearest edge, so an entry reached by
     * keyboard and one reached by double-click end up in the same place. Near
     * the ends of the list the browser clamps, which is the honest answer since
     * the row list, unlike the date range, has nothing left to extend.
     */
    function locateRow(index: number) {
        const element = scrollerRef.current;
        const row = projection.rows[index];
        if (!element || !row) return;
        element.scrollTop = Math.max(
            0,
            Math.round(index * ROW_HEIGHT + ROW_HEIGHT / 2 + HEADER_HEIGHT / 2 - element.clientHeight / 2),
        );
        setViewport((v) => ({ ...v, top: element.scrollTop }));
        const lead = Math.max(FIRST_DAY, dayIndex(row.firstDate) - LOCATE_LEAD_COLUMNS);
        const next = rangeForAnchor(range, lead, width, trackWidth(), projection.rows.length);
        if (!next || (next.start === range.start && next.end === range.end)) {
            // Already wide enough, or too wide to widen; a clamp here is the real boundary.
            element.scrollLeft = Math.max(0, (lead - range.start) * width);
            return;
        }
        pendingScrollRef.current = Math.max(0, (lead - next.start) * width);
        setRange(next);
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
                            const nextRange = rangeForAnchor(range, anchor, next, trackWidth(), projection.rows.length);
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
                        if (event.target !== event.currentTarget) return;
                        if (event.key in movements) {
                            event.preventDefault();
                            moveRow(movements[event.key] ?? active);
                            return;
                        }
                        // The keyboard equivalent of double-click. Traversal stays
                        // selection-only, so locating remains a deliberate act.
                        if (event.key === "Enter") {
                            event.preventDefault();
                            locateRow(active);
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
                            // A marker sits over the bar's start, so the title reserves room for it.
                            const marker =
                                row.milestone ||
                                (row.temporal.kind === "datetime" && row.temporal.endExclusive === null);
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
                                            onDoubleClick={() => {
                                                locateRow(index);
                                            }}
                                        >
                                            {node.title}
                                        </button>
                                    </div>
                                    <div
                                        role="gridcell"
                                        aria-label={`${node.title}: ${label(row)}${ganttProgressLabel(node.progress)}`}
                                        onClick={() => {
                                            setActive(index);
                                            scrollerRef.current?.focus({ preventScroll: true });
                                        }}
                                        onDoubleClick={() => {
                                            locateRow(index);
                                        }}
                                        className="relative flex-1"
                                        style={{
                                            backgroundImage:
                                                "repeating-linear-gradient(to right, var(--gantt-rule) 0, var(--gantt-rule) 1px, transparent 1px, transparent var(--gantt-day))",
                                        }}
                                    >
                                        <div
                                            aria-hidden="true"
                                            className="bg-base-300 border-base-content/30 absolute top-2 flex h-5 items-center overflow-hidden rounded-sm border border-l-2"
                                            style={{
                                                left: `calc((${String(first)} - var(--gantt-origin)) * var(--gantt-day))`,
                                                width: `calc(${String(duration)} * var(--gantt-day))`,
                                                borderLeftColor: validColor,
                                            }}
                                        >
                                            {node.progress !== undefined && (
                                                // Fills part of the bar and never changes where the bar
                                                // starts or ends, so progress cannot be read as schedule.
                                                <div
                                                    data-gantt-progress={node.progress}
                                                    className="bg-base-content/70 absolute inset-y-0 left-0"
                                                    style={{ width: `${String(node.progress)}%` }}
                                                />
                                            )}
                                            {/* Decoration only: the gridcell's accessible name already
                                                states the title and range, and the sticky column names
                                                every row, so a bar too narrow to read simply clips.
                                                The title is drawn twice and the second copy is clipped to
                                                the fill, so each half of the label sits on a background it
                                                contrasts with. Both copies share a box, so the glyphs align
                                                exactly and the seam falls wherever the fill ends. */}
                                            <span
                                                className={`text-base-content/80 absolute inset-0 truncate py-0 pr-1 text-[10px]/5 ${marker ? "pl-4" : "pl-1"}`}
                                            >
                                                {node.title}
                                            </span>
                                            {node.progress !== undefined && (
                                                <span
                                                    className={`text-base-100 absolute inset-0 truncate py-0 pr-1 text-[10px]/5 ${marker ? "pl-4" : "pl-1"}`}
                                                    style={{
                                                        clipPath: `inset(0 ${String(100 - node.progress)}% 0 0)`,
                                                    }}
                                                >
                                                    {node.title}
                                                </span>
                                            )}
                                        </div>
                                        {marker && (
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
                            data-gantt-connectors=""
                            className="pointer-events-none absolute top-0"
                            style={{ left: TITLE_WIDTH }}
                            width={columns * width}
                            height={projection.rows.length * ROW_HEIGHT + HEADER_HEIGHT}
                        >
                            <defs>
                                <marker
                                    id={`${id}-arrow`}
                                    markerWidth="6"
                                    markerHeight="6"
                                    refX="5"
                                    refY="3"
                                    orient="auto-start-reverse"
                                >
                                    <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
                                </marker>
                            </defs>
                            {selectedEdges.map((edge) => {
                                const from = positions.get(edge.from);
                                const to = positions.get(edge.to);
                                // Geometry is arithmetic over row index and day offset, so an endpoint
                                // outside the rendered row window is still drawable.
                                if (!from || !to) return null;
                                const x1 = (dayIndex(from.row.afterLastDate) - range.start) * width;
                                const x2 = (dayIndex(to.row.firstDate) - range.start) * width;
                                const y1 = HEADER_HEIGHT + (from.index + 0.5) * ROW_HEIGHT;
                                const y2 = HEADER_HEIGHT + (to.index + 0.5) * ROW_HEIGHT;
                                // A successor that starts before its predecessor ends is ordinary data,
                                // because no conflict is computed. Route around it instead of drawing a
                                // segment that doubles back through both bars.
                                const gap = 8;
                                const direct = x2 >= x1 + gap * 2;
                                // Keep an 8px approach before the successor. Narrow direct gaps
                                // share the remaining lanes; detours use the base riser so their
                                // longer return segment is not made worse by lane offsets.
                                const lane = direct
                                    ? Math.min(
                                          connectorLane.get(edge.id) ?? 0,
                                          Math.floor((x2 - x1 - gap * 2) / CONNECTOR_LANE_STEP),
                                      )
                                    : 0;
                                const riser = x1 + gap + CONNECTOR_LANE_STEP * lane;
                                const detour = y2 + (y1 < y2 ? -ROW_HEIGHT / 2 : ROW_HEIGHT / 2);
                                const d = direct
                                    ? `M ${String(x1)} ${String(y1)} H ${String(riser)} V ${String(y2)} H ${String(x2)}`
                                    : `M ${String(x1)} ${String(y1)} H ${String(riser)} V ${String(detour)} H ${String(x2 - gap)} V ${String(y2)} H ${String(x2)}`;
                                return (
                                    <path
                                        key={edge.id}
                                        d={d}
                                        fill="none"
                                        stroke="currentColor"
                                        markerEnd={`url(#${id}-arrow)`}
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
                    <p>
                        {selected
                            ? label(selected)
                            : selectedNode.status === "invalid"
                              ? "Invalid interval"
                              : "Unscheduled"}
                        {ganttProgressLabel(selectedNode.progress)}
                    </p>
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
                Home and End keys in the timeline to select entries, and Enter to bring the selected entry's bar into
                view.
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
