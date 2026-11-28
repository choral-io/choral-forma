import type {
    CalendarProjection,
    DirectoryIntroduction,
    GanttProjection,
    ReferenceEdge,
    ViewDocumentHeadings,
} from "@choral-forma/shared";

export type WorkspaceHealth = "healthy" | "warning" | "failed";

export interface DashboardEntry {
    id: string;
    kind?: string;
    path: string;
    routePath: string;
    rawPath?: string;
    title: string;
    omitLeadingTitle: boolean;
    summary: string;
    space: string;
    updatedAt?: string;
    updatedLabel: string;
    status: WorkspaceHealth;
    body: DashboardEntryBlock[];
    diagnostics?: DashboardDiagnostic[];
    relations: DashboardEntryRelations;
    variants: DashboardEntryVariant[];
}

export interface DashboardEntryVariant {
    id?: string;
    language: string;
    path: string;
    routePath: string;
    rawPath: string;
    kind?: string;
    title?: string;
    omitLeadingTitle?: boolean;
    summary?: string;
}

export type DashboardEntryBlock =
    | {
          type: "markdown";
          markdown: string;
          anchors?: { id: string; level: number; text: string }[];
          outline: DashboardEntryHeading[];
      }
    | {
          type: "html";
          html: string;
          outline: DashboardEntryHeading[];
      }
    | {
          type: "heading";
          level: 2 | 3;
          text: string;
      }
    | {
          type: "paragraph";
          text: string;
      }
    | {
          type: "list";
          items: string[];
      }
    | {
          type: "quote";
          text: string;
      }
    | {
          type: "code";
          language: string;
          code: string;
      }
    | {
          type: "table";
          columns: string[];
          rows: string[][];
      };

export interface DashboardEntryHeading {
    id: string;
    level: 2 | 3;
    text: string;
}

export interface DashboardEntryLink {
    kind: "external" | "internal" | "unresolved";
    label: string;
    targetEntryId?: string;
    targetRoutePath?: string;
    targetPath: string;
}

export interface DashboardEntryRelations {
    outgoing: DashboardEntryLink[];
    backlinks: DashboardEntryLink[];
}

export function mapEntryRelations(
    references: { outgoing?: ReferenceEdge[]; backlinks?: ReferenceEdge[] },
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardEntryRelations {
    const mapLink = (path: string, title: string | undefined): DashboardEntryLink => {
        const entry = entriesByPath.get(path);
        // Core indexes HTTP(S), protocol-relative, and mailto URLs as external body references.
        const external = /^(?:https?:\/\/|\/\/|mailto:)/u.test(path);
        return {
            kind: entry ? "internal" : external ? "external" : "unresolved",
            label: title ?? path,
            targetEntryId: entry?.id,
            targetRoutePath: entry?.routePath,
            targetPath: path,
        };
    };

    return {
        outgoing: (references.outgoing ?? []).map((edge) => mapLink(edge.targetPath, edge.targetTitle)),
        backlinks: (references.backlinks ?? []).map((edge) => mapLink(edge.sourcePath, edge.sourceTitle)),
    };
}

export interface DashboardSpace {
    id: string;
    title: string;
    display?: DisplayOptions;
    description: string;
    entryCount: number;
    path: string;
    status: WorkspaceHealth;
    updatedAt?: string;
    updatedLabel: string;
}

export interface DashboardTaxonomyTerm {
    id: string;
    routePath: string;
    title: string;
    display?: DisplayOptions;
    description: string;
    entryCount: number;
    entries: DashboardEntry[];
    status: WorkspaceHealth;
}

export interface DashboardTaxonomy {
    id: string;
    routePath: string;
    title: string;
    mode: string;
    display?: DisplayOptions;
    description: string;
    terms: DashboardTaxonomyTerm[];
}

export interface DashboardDiagnostic {
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    path?: string;
    location?: {
        column?: number;
        field?: string;
        index?: number;
        kind: "body" | "config" | "file" | "frontmatter";
        line?: number;
    };
    actual?: unknown;
    expected?: unknown;
    instancePath?: string;
    schemaPath?: string;
    keyword?: string;
}

export type DashboardHealthCategory =
    "brokenReference" | "ambiguousReference" | "noOutgoingReferences" | "noBacklinks" | "configDiagnostic";

export interface DashboardHealthFinding {
    category: DashboardHealthCategory;
    severity: "error" | "warning" | "info";
    path: string;
    message: string;
    target?: string;
    routePath?: string;
    title?: string;
}

export interface DashboardHealth {
    status: WorkspaceHealth;
    diagnostics: DashboardDiagnostic[];
    findings: DashboardHealthFinding[];
}

export interface DashboardView {
    id: string;
    path: string;
    configId: string;
    sourcePath: string;
    publicId: string;
    routePath: string;
    title: string;
    display?: DisplayOptions;
    description: string;
    kind: "list" | "table" | "kanban" | "graph" | "calendar" | "gantt";
    space?: string;
}

export interface DisplayOptions {
    order?: number;
    icon?: string;
    color?: string;
}

export interface DashboardViewProjectionItem {
    entryId?: string;
    routePath?: string;
    fields: Record<string, string>;
    rawFields: Record<string, DashboardViewFieldValue>;
    path: string;
    title: string;
}

export interface DashboardViewReference {
    path: string;
    routePath?: string;
    title: string;
}

export type DashboardViewFieldValue =
    | { kind: "value"; value: unknown }
    | { kind: "reference"; reference: DashboardViewReference }
    | { kind: "referenceList"; references: DashboardViewReference[] };

export interface DashboardGraphNode {
    space: string;
    entryId?: string;
    routePath?: string;
    id: string;
    kind?: string;
    path: string;
    title: string;
    classification?: DashboardGraphClassification;
}

interface DashboardGraphClassificationBase {
    key: string;
    label: string;
}

export type DashboardGraphClassification = DashboardGraphClassificationBase &
    ({ taxonomy: string; terms?: string[]; field?: never } | { field: string; taxonomy?: never; terms?: never });

export type DashboardGraphLegendItem = DashboardGraphClassification & { color?: string };

export interface DashboardGraphEdge {
    id: string;
    intent: "reference" | "link" | "embed";
    referenceSource: "frontmatter" | "body";
    label: string;
    fragment?: string;
    fragmentKind?: "heading" | "block";
    field?: string;
    semanticType?: string;
    source: string;
    sourcePath: string;
    target: string;
    targetPath: string;
}

export interface DashboardViewColumn {
    field: string;
    label: string;
    link?: {
        target: "entry";
    };
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    overflow?: "wrap" | "truncate";
}

export type DashboardViewProjection =
    | (CalendarProjection & { routes: Record<string, string> })
    | (GanttProjection & { routes: Record<string, string>; canonicalLanguage?: string })
    | {
          kind: "list";
          items: DashboardViewProjectionItem[];
      }
    | {
          kind: "table";
          columns: DashboardViewColumn[];
          items: DashboardViewProjectionItem[];
      }
    | {
          kind: "kanban";
          card: {
              titleField: string;
              subtitleFields: string[];
              badgeFields: string[];
          };
          columns: {
              id: string;
              icon?: string;
              items: DashboardViewProjectionItem[];
              label: string;
          }[];
      }
    | {
          kind: "graph";
          edges: DashboardGraphEdge[];
          nodes: DashboardGraphNode[];
          legend: DashboardGraphLegendItem[];
      };

export interface DashboardViewRender {
    document: {
        afterProjection: string;
        beforeProjection: string;
        hasProjectionMount?: boolean;
        headings?: ViewDocumentHeadings;
        path: string;
    };
    projection: DashboardViewProjection;
}

export interface WorkspaceDashboard {
    workspaceName: string;
    routeGeneration?: string;
    canonicalLanguage?: string;
    workspaceLogo?: {
        url: string;
        alt: string;
    };
    tagline: string;
    status: WorkspaceHealth;
    taxonomies: DashboardTaxonomy[];
    spaces: DashboardSpace[];
    entries: DashboardEntry[];
    directories: DashboardDirectory[];
    diagnostics: DashboardDiagnostic[];
    health: DashboardHealth;
    views: DashboardView[];
}

export interface DashboardDirectory {
    path: string;
    routePath: string;
    introduction?: DirectoryIntroduction;
    childDirectoryPaths: string[];
    entryPaths: string[];
}

/**
 * The read model a detail request resolves against, built once by the caller.
 *
 * Clients hold no dashboard of their own, so the caller owns how long this stays
 * valid. `dashboard` carries the parts that are not entry lookups, such as the
 * configured Views a View render resolves its summary from.
 */
export interface WorkspaceDashboardContext {
    dashboard: WorkspaceDashboard;
    entriesById: ReadonlyMap<string, DashboardEntry>;
    entriesByPath: ReadonlyMap<string, DashboardEntry>;
}

export function createWorkspaceDashboardContext(dashboard: WorkspaceDashboard): WorkspaceDashboardContext {
    const entriesById = new Map<string, DashboardEntry>();
    const entriesByPath = new Map<string, DashboardEntry>();

    for (const entry of dashboard.entries) {
        entriesById.set(entry.id, entry);
        entriesByPath.set(entry.path, entry);
    }

    return { dashboard, entriesById, entriesByPath };
}

/**
 * Latest `updatedAt` across the given entries, or undefined when none is dated.
 * Independent of iteration order so both runtimes report the same value.
 */
export function latestUpdatedAt(entries: Iterable<DashboardEntry>): string | undefined {
    let latest: string | undefined;
    let latestValue = Number.NEGATIVE_INFINITY;

    for (const entry of entries) {
        if (!entry.updatedAt) continue;
        // Compare instants rather than text so a mixed UTC offset cannot reorder them.
        const value = new Date(entry.updatedAt).valueOf();
        if (Number.isNaN(value) || value <= latestValue) continue;
        latest = entry.updatedAt;
        latestValue = value;
    }

    return latest;
}

export interface WorkspaceClient {
    getDashboard(): Promise<WorkspaceDashboard>;
    getEntry(entryPath: string, context: WorkspaceDashboardContext): Promise<DashboardEntry>;
    getViewRender(configId: string, context: WorkspaceDashboardContext): Promise<DashboardViewRender>;
    getHealth?(): Promise<DashboardHealth>;
    subscribeInvalidation?(listener: (error: Error) => void): () => void;
}
