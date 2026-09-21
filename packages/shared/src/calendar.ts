export interface CalendarEntry {
    path: string;
    title: string;
    classification?: { label: string; color: string | null };
}

export interface CalendarEvent extends CalendarEntry {
    temporal:
        | { kind: "date"; start: string; endExclusive: string }
        | { kind: "datetime"; start: string; endExclusive: string | null };
    firstDate: string;
    afterLastDate: string;
}

export interface CalendarProjection {
    kind: "calendar";
    timeZone: string;
    firstDayOfWeek: "monday" | "sunday";
    counts: { candidates: number; scheduled: number; unscheduled: number; invalid: number };
    events: CalendarEvent[];
    unscheduled: CalendarEntry[];
}

/** Shared by WebApp and VS Code; never interpret source fields here. */
export function calendarEventLabel(event: CalendarEvent, timeZone: string, locale?: string): string {
    if (event.temporal.kind === "date") {
        const end = new Date(`${event.temporal.endExclusive}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() - 1);
        const last = end.toISOString().slice(0, 10);
        return event.temporal.start === last ? `${last} · All day` : `${event.temporal.start} – ${last} · All day`;
    }
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone });
    const start = formatter.format(new Date(event.temporal.start));
    return event.temporal.endExclusive
        ? `${start} – ${formatter.format(new Date(event.temporal.endExclusive))} (${timeZone}, end exclusive)`
        : `${start} (${timeZone})`;
}
