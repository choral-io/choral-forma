import { normalizeDisplayColor } from "@choral-forma/shared";
import {
    BookOpen,
    Boxes,
    Calendar,
    CalendarDays,
    ChartGantt,
    CircleCheck,
    Ellipsis,
    Eye,
    FileText,
    FlaskConical,
    Folder,
    FolderTree,
    Kanban,
    Lightbulb,
    List,
    ListChecks,
    Network,
    Package,
    PanelsTopLeft,
    Rocket,
    Shapes,
    TableProperties,
    Tags,
    TriangleAlert,
    Users,
    type LucideIcon,
} from "lucide-react";

import type { DisplayOptions } from "@/data/workspace-client";

/** Bundled glyphs for Core's provider-neutral display icon registry. */
export const displayIcons: Readonly<Record<string, LucideIcon>> = {
    "book-open": BookOpen,
    "boxes": Boxes,
    "calendar": Calendar,
    "calendar-days": CalendarDays,
    "chart-gantt": ChartGantt,
    "circle-check": CircleCheck,
    "ellipsis": Ellipsis,
    "eye": Eye,
    "file-text": FileText,
    "flask-conical": FlaskConical,
    "folder": Folder,
    "folder-tree": FolderTree,
    "kanban": Kanban,
    "lightbulb": Lightbulb,
    "list": List,
    "list-checks": ListChecks,
    "network": Network,
    "package": Package,
    "panels-top-left": PanelsTopLeft,
    "rocket": Rocket,
    "shapes": Shapes,
    "table-properties": TableProperties,
    "tags": Tags,
    "triangle-alert": TriangleAlert,
    "users": Users,
};

/** The configured icon id when this client bundles it, otherwise the caller's fallback id. */
export function displayIconId(display: DisplayOptions | undefined, fallback: string): string {
    return display?.icon && Object.hasOwn(displayIcons, display.icon) ? display.icon : fallback;
}

/** A configured color in Core's `#RRGGBB` form, or undefined so the theme's text color applies. */
export function displayColor(display: DisplayOptions | undefined): string | undefined {
    return normalizeDisplayColor(display?.color);
}
