import { calendarEventLabel, type CalendarEntry, type CalendarEvent, type CalendarProjection } from "./calendar";

export interface GanttDependencies {
    declared: number;
    outsideSelection: number;
    unresolved: number;
    duplicates: number;
    selfReferences: number;
    predecessors: string[];
}
export interface GanttNode extends CalendarEntry {
    status: "scheduled" | "unscheduled" | "invalid";
    /** Whole percent, 0-100. Absent and 0 are different states. */
    progress?: number;
    dependencies: GanttDependencies;
}
export interface GanttRow extends Omit<CalendarEvent, "title" | "classification"> {
    milestone: boolean;
}
export interface GanttEdge {
    id: string;
    from: string;
    to: string;
    relation: "finishToStart";
    status: "anchored" | "unanchored";
}
export interface GanttProjection {
    kind: "gantt";
    timeZone: string;
    counts: CalendarProjection["counts"];
    nodes: GanttNode[];
    rows: GanttRow[];
    edges: GanttEdge[];
}
export function ganttRowLabel(row: GanttRow, timeZone: string, locale: string): string {
    return `${calendarEventLabel({ ...row, title: "" }, timeZone, locale)}${row.milestone ? " · Milestone" : ""}`;
}
/** Empty when no progress was authored, so an absent value never reads as zero. */
export function ganttProgressLabel(progress: number | undefined): string {
    return progress === undefined ? "" : ` · ${String(progress)}% complete`;
}
export function ganttDependencySummary(value: GanttDependencies): string {
    return `${String(value.outsideSelection)} outside selection · ${String(value.unresolved)} unresolved · ${String(value.duplicates)} duplicates · ${String(value.selfReferences)} self references`;
}
