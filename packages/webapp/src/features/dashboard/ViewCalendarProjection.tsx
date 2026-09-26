import type { DashboardViewProjection } from "@/data/workspace-client";
import { calendarEventLabel, type CalendarEntry, type CalendarEvent } from "@choral-forma/shared";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
    calendarJumpMonth,
    calendarJumpPosition,
    calendarPreviewWindow,
    civilDate,
    dateInZone,
    monthDays,
    overlaps,
    shiftMonth,
} from "./calendar-layout";

type Projection = Extract<DashboardViewProjection, { kind: "calendar" }>;

export function ViewCalendarProjection({ projection }: { projection: Projection }) {
    const [today, setToday] = useState(() => dateInZone(new Date(), projection.timeZone));
    const [month, setMonth] = useState(() => today.slice(0, 7));
    const [agenda, setAgenda] = useState(false);
    const [selectedDay, setSelectedDay] = useState<string>();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogId = useId();
    const location = useLocation();
    useEffect(() => {
        dialogRef.current?.close("navigate");
    }, [location.key, month, agenda]);
    const selectedEvents = selectedDay
        ? projection.events.filter((event) => event.firstDate <= selectedDay && event.afterLastDate > selectedDay)
        : [];
    const days = monthDays(month, projection.firstDayOfWeek);
    const end = month === "9999-12" ? "9999-12-31" : `${shiftMonth(month, 1)}-01`;
    const visible = projection.events.filter((event) => overlaps(event, `${month}-01`, end));
    const monthLabel = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", timeZone: "UTC" }).format(
        civilDate(`${month}-01`),
    );
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
    const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: "UTC" });

    return (
        <section aria-label="Calendar" className="@container/calendar space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <CalendarMonthJump month={month} label={monthLabel} onJump={setMonth} />
                <div className="flex flex-wrap items-center gap-3">
                    <div className="join" role="group" aria-label="Calendar navigation">
                        <button
                            type="button"
                            className="btn join-item btn-square btn-sm"
                            aria-label="Previous month"
                            title="Previous month"
                            disabled={month <= "0001-01"}
                            onClick={() => {
                                setMonth(shiftMonth(month, -1));
                            }}
                        >
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="btn join-item btn-sm"
                            onClick={() => {
                                const current = dateInZone(new Date(), projection.timeZone);
                                setToday(current);
                                setMonth(current.slice(0, 7));
                            }}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            className="btn join-item btn-square btn-sm"
                            aria-label="Next month"
                            title="Next month"
                            disabled={month >= "9999-12"}
                            onClick={() => {
                                setMonth(shiftMonth(month, 1));
                            }}
                        >
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div
                        className="join hidden @min-[40rem]/calendar:inline-flex"
                        role="group"
                        aria-label="Calendar display"
                    >
                        <button
                            type="button"
                            className={`btn join-item btn-sm ${!agenda ? "btn-active" : "btn-ghost"}`}
                            aria-pressed={!agenda}
                            onClick={() => {
                                setAgenda(false);
                            }}
                        >
                            Month
                        </button>
                        <button
                            type="button"
                            className={`btn join-item btn-sm ${agenda ? "btn-active" : "btn-ghost"}`}
                            aria-pressed={agenda}
                            onClick={() => {
                                setAgenda(true);
                            }}
                        >
                            Agenda
                        </button>
                    </div>
                </div>
            </div>
            <p className="text-sm text-base-content/70">
                {visible.length} events this month · {projection.timeZone}
                {projection.counts.invalid > 0
                    ? ` · ${String(projection.counts.invalid)} invalid entries (see diagnostics)`
                    : ""}
            </p>
            {!agenda && (
                <div className="hidden rounded-box border border-base-300 @min-[40rem]/calendar:block">
                    <div className="grid grid-cols-7">
                        {days.slice(0, 7).map((day) => (
                            <div key={day} className="p-2 text-sm font-medium">
                                {weekday.format(civilDate(day))}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            if (day.length !== 10 || day < "0001-01-01") {
                                return <div key={day} aria-hidden="true" className="border-t border-base-300" />;
                            }
                            const events = projection.events.filter(
                                (event) => event.firstDate <= day && event.afterLastDate > day,
                            );
                            return (
                                <CalendarDay
                                    key={day}
                                    day={day}
                                    label={dateLabel.format(civilDate(day))}
                                    today={today}
                                    outside={!day.startsWith(month)}
                                    events={events}
                                    projection={projection}
                                    dialogId={dialogId}
                                    onOpen={(trigger) => {
                                        triggerRef.current = trigger;
                                        setSelectedDay(day);
                                        if (dialogRef.current) dialogRef.current.returnValue = "";
                                        dialogRef.current?.showModal();
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            <div className={agenda ? "" : "@min-[40rem]/calendar:hidden"}>
                <h3 className="mb-2 font-semibold">Agenda</h3>
                <ul className="divide-y divide-base-300">
                    {visible.map((event) => (
                        <li key={event.path} className="py-3">
                            <EventLink entry={event} projection={projection} />
                            <p className="mt-1 text-sm text-base-content/70">
                                {calendarEventLabel(event, projection.timeZone)}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
            {visible.length === 0 && <p>No events in this month.</p>}
            {projection.unscheduled.length > 0 && (
                <section>
                    <h3 className="font-semibold">Unscheduled ({projection.unscheduled.length})</h3>
                    <ul className="mt-2 space-y-2">
                        {projection.unscheduled.map((entry) => (
                            <li key={entry.path}>
                                <EventLink entry={entry} projection={projection} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <dialog
                ref={dialogRef}
                id={dialogId}
                aria-labelledby={`${dialogId}-title`}
                className="modal modal-end bg-neutral/40 p-0 backdrop-blur-xs outline-none motion-reduce:transition-none"
                onClose={(event) => {
                    if (event.currentTarget.returnValue !== "navigate")
                        triggerRef.current?.focus({ preventScroll: true });
                }}
            >
                <div className="modal-box flex h-svh max-h-none w-full max-w-105 flex-col rounded-none bg-base-100 p-0 motion-reduce:transition-none">
                    <header className="flex shrink-0 items-start gap-4 border-b border-base-300 p-5">
                        <div className="min-w-0 flex-1">
                            <h2 id={`${dialogId}-title`} className="text-lg font-semibold">
                                {selectedDay ? dateLabel.format(civilDate(selectedDay)) : "Day events"}
                            </h2>
                            <p className="mt-1 text-sm text-base-content/70">
                                {selectedEvents.length} events · {projection.timeZone}
                            </p>
                        </div>
                        <form method="dialog">
                            <button
                                className="btn btn-square btn-ghost btn-sm"
                                aria-label="Close day events"
                                value="close"
                            >
                                <X className="size-5" aria-hidden="true" />
                            </button>
                        </form>
                    </header>
                    <ul className="min-h-0 flex-1 divide-y divide-base-300 overflow-y-auto overscroll-contain px-5">
                        {selectedEvents.map((event) => (
                            <li key={event.path} className="py-4">
                                <EventLink
                                    entry={event}
                                    projection={projection}
                                    onNavigate={() => {
                                        dialogRef.current?.close("navigate");
                                    }}
                                />
                                <p className="mt-1 text-sm text-base-content/70">
                                    {calendarEventLabel(event, projection.timeZone)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button aria-label="Dismiss day events" value="close">
                        Close
                    </button>
                </form>
            </dialog>
        </section>
    );
}

function CalendarMonthJump({
    month,
    label,
    onJump,
}: {
    month: string;
    label: string;
    onJump: (month: string) => void;
}) {
    const id = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputType] = useState<"month" | "date">(() => {
        const probe = document.createElement("input");
        probe.type = "month";
        return probe.type === "month" ? "month" : "date";
    });
    const initialValue = inputType === "month" ? month : `${month}-01`;
    useEffect(() => {
        const panel = panelRef.current;
        const trigger = triggerRef.current;
        if (!panel || !trigger) return;
        const position = () => {
            if (!panel.matches(":popover-open")) return;
            const point = calendarJumpPosition(trigger.getBoundingClientRect(), panel.getBoundingClientRect(), {
                width: window.innerWidth,
                height: window.innerHeight,
            });
            panel.style.left = `${String(point.left)}px`;
            panel.style.top = `${String(point.top)}px`;
        };
        const observer = new ResizeObserver(position);
        observer.observe(panel);
        panel.addEventListener("toggle", position);
        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, true);
        return () => {
            observer.disconnect();
            panel.removeEventListener("toggle", position);
            window.removeEventListener("resize", position);
            window.removeEventListener("scroll", position, true);
        };
    }, []);

    return (
        <>
            <h2 aria-live="polite">
                <button
                    ref={triggerRef}
                    type="button"
                    className="btn -ml-3 gap-2 btn-ghost text-xl font-semibold tracking-tight"
                    aria-label={`Jump to month, ${label}`}
                    aria-haspopup="dialog"
                    popoverTarget={id}
                >
                    {label}
                    <ChevronDown className="size-4" aria-hidden="true" />
                </button>
            </h2>
            <div
                ref={panelRef}
                id={id}
                popover="auto"
                role="dialog"
                aria-label="Jump to month"
                className="fixed m-0 max-h-[calc(100dvh-2rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-4 text-sm font-normal tracking-normal shadow-lg"
                onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    panelRef.current?.hidePopover();
                    triggerRef.current?.focus();
                }}
                onBeforeToggle={(event) => {
                    if (event.newState !== "open" || !inputRef.current) return;
                    inputRef.current.value = initialValue;
                    inputRef.current.setCustomValidity("");
                }}
            >
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const value = calendarJumpMonth(inputRef.current?.value ?? "", inputType);
                        if (!value) {
                            inputRef.current?.setCustomValidity(
                                "Enter a month between January 0001 and December 9999.",
                            );
                            inputRef.current?.reportValidity();
                            return;
                        }
                        panelRef.current?.hidePopover();
                        triggerRef.current?.focus();
                        onJump(value);
                    }}
                >
                    <label className="block space-y-2">
                        <span className="font-medium">{inputType === "month" ? "Month" : "Date"}</span>
                        <input
                            ref={inputRef}
                            type={inputType}
                            className="input w-full"
                            defaultValue={initialValue}
                            min={inputType === "month" ? "0001-01" : "0001-01-01"}
                            max={inputType === "month" ? "9999-12" : "9999-12-31"}
                            required
                            onInput={(event) => {
                                event.currentTarget.setCustomValidity("");
                            }}
                        />
                    </label>
                    <p className="text-xs text-base-content/70">
                        {inputType === "month"
                            ? "Choose or type a month and year."
                            : "Choose or type a date to open its month."}
                    </p>
                    <button type="submit" className="btn w-full btn-primary btn-sm">
                        Jump
                    </button>
                </form>
            </div>
        </>
    );
}

function EventLink({
    entry,
    projection,
    compact = false,
    onNavigate,
}: {
    entry: CalendarEntry | CalendarEvent;
    projection: Projection;
    compact?: boolean;
    onNavigate?: () => void;
}) {
    const route = projection.routes[entry.path];
    const label = "temporal" in entry ? calendarEventLabel(entry, projection.timeZone) : undefined;
    const classification = entry.classification;
    const color =
        classification?.color && /^#[0-9a-f]{6}$/i.test(classification.color) ? classification.color : undefined;
    const borderStyle = color ? { borderLeftColor: color } : undefined;
    const content = route ? (
        <Link
            className={
                compact
                    ? "block rounded-sm border-l-2 border-base-300 bg-base-content/5 py-0.5 pr-1.5 pl-1 -outline-offset-2 hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-base-content"
                    : "link wrap-anywhere"
            }
            style={compact ? borderStyle : undefined}
            to={route}
            title={label ? `${entry.title}: ${label}` : entry.title}
            aria-label={label ? `${entry.title}: ${label}` : undefined}
            onClick={onNavigate}
        >
            <span className={compact ? "line-clamp-2 wrap-anywhere" : undefined}>{entry.title}</span>
        </Link>
    ) : (
        <span
            className={
                compact
                    ? "block rounded-sm border-l-2 border-base-300 bg-base-content/5 py-0.5 pr-1.5 pl-1"
                    : "wrap-anywhere"
            }
            style={compact ? borderStyle : undefined}
            title={label}
        >
            <span className={compact ? "line-clamp-2 wrap-anywhere" : undefined}>{entry.title}</span>
        </span>
    );
    return (
        <div
            className={compact ? undefined : "border-l-2 border-base-300 pl-1.5"}
            style={compact ? undefined : borderStyle}
        >
            {content}
            {classification && (
                <span className={compact ? "sr-only" : "mt-1 block text-sm text-base-content/70"}>
                    {classification.label}
                </span>
            )}
        </div>
    );
}

function CalendarDay({
    day,
    label,
    today,
    outside,
    events,
    projection,
    dialogId,
    onOpen,
}: {
    day: string;
    label: string;
    today: string;
    outside: boolean;
    events: CalendarEvent[];
    projection: Projection;
    dialogId: string;
    onOpen: (trigger: HTMLButtonElement) => void;
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [limit, setLimit] = useState(8);
    const [fade, setFade] = useState<number>();
    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const list = listRef.current;
        if (!viewport || !list) return;
        const measure = () => {
            const height = viewport.getBoundingClientRect().height;
            if (!height) return;
            const lineHeight = Number.parseFloat(getComputedStyle(list).lineHeight);
            // A conservative bound: enough one-line items to fill the area, plus one.
            // Actual wrapping is measured below; the full day is mounted only in the drawer.
            setLimit(Math.ceil(height / lineHeight) + 1);
            const top = list.getBoundingClientRect().top;
            const items = Array.from(list.children) as HTMLLIElement[];
            const bottoms = items.map((item) => item.getBoundingClientRect().bottom - top);
            const window = calendarPreviewWindow(height, bottoms, events.length, lineHeight);
            items.forEach((item, index) => {
                item.inert = index >= window.visible;
                if (index >= window.visible) item.setAttribute("aria-hidden", "true");
                else item.removeAttribute("aria-hidden");
            });
            setFade(window.fade);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        observer.observe(list);
        return () => {
            observer.disconnect();
        };
    }, [events, limit]);
    return (
        <section
            aria-label={label}
            className={`flex h-42 min-w-0 flex-col border-t border-base-300 p-2 @min-[56rem]/calendar:h-54 ${outside ? "bg-base-200/50" : ""}`}
        >
            <div className="mb-2 flex h-7 shrink-0 items-center justify-between gap-1">
                <h3 className="text-sm font-medium">
                    <time
                        dateTime={day}
                        aria-label={day === today ? `${label}, today` : label}
                        aria-current={day === today ? "date" : undefined}
                        className={`inline-flex size-7 items-center justify-center rounded-full ${day === today ? "bg-primary text-primary-content" : outside ? "text-base-content/60" : ""}`}
                    >
                        {day.slice(8)}
                    </time>
                </h3>
                {events.length > 0 && (
                    <button
                        type="button"
                        className="btn min-h-7 min-w-7 rounded-full bg-base-content/5 btn-ghost px-2 tabular-nums btn-xs"
                        aria-label={`View ${String(events.length)} events on ${label}`}
                        aria-haspopup="dialog"
                        aria-controls={dialogId}
                        title="View all events for this day"
                        onClick={(event) => {
                            onOpen(event.currentTarget);
                        }}
                    >
                        {events.length}
                    </button>
                )}
            </div>
            <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden">
                <ul
                    ref={listRef}
                    className="space-y-1 text-sm/5"
                    style={
                        fade === undefined
                            ? undefined
                            : {
                                  maskImage: `linear-gradient(to bottom, black ${String(fade)}px, transparent 100%)`,
                                  height: "100%",
                              }
                    }
                >
                    {events.slice(0, limit).map((event) => (
                        <li key={event.path}>
                            <EventLink entry={event} projection={projection} compact />
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
