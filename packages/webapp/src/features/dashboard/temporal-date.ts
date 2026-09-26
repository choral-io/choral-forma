// Display/layout helpers only. Core owns event normalization and timezone semantics.
// UTC here is a Gregorian civil-date container, never the event timezone.
export function civilDate(value: string): Date {
    return new Date(`${value}T00:00:00Z`);
}

export function dateKey(value: Date): string {
    const iso = value.toISOString();
    return iso.slice(0, iso.indexOf("T"));
}

export function dateInZone(now: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
