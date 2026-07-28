export function stringifyStaticFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.map(stringifyStaticFieldValue).filter(Boolean).join(", ");
    }

    return JSON.stringify(value);
}
