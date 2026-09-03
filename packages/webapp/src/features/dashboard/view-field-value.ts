import type { DashboardViewFieldValue, DashboardViewProjectionItem } from "@/data/workspace-client";

export function rawViewFieldValue(item: DashboardViewProjectionItem, field: string): unknown {
    if (field === "path" || field === "entry.path") return item.path;
    if (field === "title" || field === "entry.title") return item.title;
    const key = field.replace(/^fields\./u, "");
    return item.rawFields[field] ?? item.rawFields[key];
}

export function formattedViewFieldValue(item: DashboardViewProjectionItem, field: string): string {
    if (field === "path" || field === "entry.path") return item.path;
    if (field === "title" || field === "entry.title") return item.title;
    const key = field.replace(/^fields\./u, "");
    return item.fields[field] ?? item.fields[key] ?? "";
}

export function plainViewFieldValue(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (isValueViewField(value)) return plainViewFieldValue(value.value);
    if (isReferenceViewField(value)) {
        return value.kind === "reference"
            ? value.reference.title
            : value.references.map((reference) => reference.title).join(", ");
    }
    if (Array.isArray(value)) return value.map(plainViewFieldValue).filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    return JSON.stringify(value);
}

export function isValueViewField(value: unknown): value is Extract<DashboardViewFieldValue, { kind: "value" }> {
    return typeof value === "object" && value !== null && "kind" in value && value.kind === "value";
}

export function isReferenceViewField(
    value: unknown,
): value is Extract<DashboardViewFieldValue, { kind: "reference" | "referenceList" }> {
    return (
        typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        (value.kind === "reference" || value.kind === "referenceList")
    );
}

export function viewFieldLabel(field: string): string {
    return field.replace(/^fields\./u, "");
}
