import { format, formatDistanceToNowStrict } from "date-fns";

export interface DisplayDateTime {
    label: string;
    title: string;
}

export function formatDisplayDateTime(value: string | undefined): DisplayDateTime {
    const date = parseDateTime(value);

    if (!date) {
        return {
            label: "—",
            title: "No date available",
        };
    }

    return {
        label: formatDistanceToNowStrict(date, { addSuffix: true }),
        title: format(date, "yyyy-MM-dd HH:mm:ss"),
    };
}

export function formatRelativeDateTime(value: string | undefined): string {
    return formatDisplayDateTime(value).label;
}

export function formatAbsoluteDateTime(value: string | undefined): string {
    return formatDisplayDateTime(value).title;
}

function parseDateTime(value: string | undefined): Date | undefined {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.valueOf()) ? undefined : date;
}
