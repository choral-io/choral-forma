import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type CheckResult,
  type ConfigInspectResult,
  type Diagnostic,
  type EntryRenderResult,
  type FilesListResult,
  FormaRpcClient,
  type IndexView,
  type ListResult,
  type OperationStatus,
  type ViewRenderOutput,
  type ViewRenderResult,
} from "@choral-forma/shared";

import "./App.css";

const rpc = new FormaRpcClient(import.meta.env.VITE_FORMA_RPC_URL ?? "/rpc");
const overviewTab: OpenTab = {
  id: "overview",
  kind: "overview",
  label: "Overview",
  title: "Workspace Overview",
};

type PaneMode = "structured" | "files" | "inspect" | "config" | "diagnostics";

type OpenTab =
  | {
      id: string;
      kind: "overview";
      label: string;
      title: string;
    }
  | {
      id: string;
      kind: "view";
      label: string;
      title: string;
      result: ViewRenderResult;
    }
  | {
      id: string;
      kind: "entry";
      label: string;
      title: string;
      path: string;
      result: EntryRenderResult;
    }
  | {
      id: string;
      kind: "collection";
      label: string;
      title: string;
      result: ListResult;
    };

type BootState = {
  check: CheckResult;
  index: CheckResult;
  config: ConfigInspectResult;
  files: FilesListResult;
};

export function App() {
  const [boot, setBoot] = useState<BootState | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([overviewTab]);
  const [activeId, setActiveId] = useState("overview");
  const [paneMode, setPaneMode] = useState<PaneMode>("structured");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([rpc.check(), rpc.indexCheck(), rpc.configInspect(), rpc.filesList()])
      .then(([check, index, config, files]) => {
        if (!cancelled) {
          setBoot({ check, index, config, files });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? overviewTab;
  const views = useMemo(() => collectViews(boot?.files), [boot?.files]);
  const collections = useMemo(() => collectCollections(boot?.config, boot?.files), [boot?.config, boot?.files]);
  const diagnostics = [...(boot?.check.diagnostics ?? []), ...(activeDiagnostics(activeTab) ?? [])];

  function upsertTab(next: OpenTab) {
    setTabs((current) => {
      const existing = current.findIndex((tab) => tab.id === next.id);
      if (existing === -1) {
        return [...current, next];
      }
      const copy = [...current];
      copy[existing] = next;
      return copy;
    });
    setActiveId(next.id);
  }

  async function openCollection(id: string, title: string) {
    try {
      const result = await rpc.list(id);
      setError(null);
      upsertTab({
        id: `collection:${id}`,
        kind: "collection",
        label: title,
        title,
        result,
      });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function openView(view: Pick<IndexView, "id" | "title">) {
    try {
      const result = await rpc.renderView(view.id);
      setError(null);
      upsertTab({
        id: `view:${view.id}`,
        kind: "view",
        label: result.view?.title ?? view.title ?? view.id,
        title: result.view?.title ?? view.title ?? view.id,
        result,
      });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function openEntry(path: string, fallbackTitle?: string) {
    try {
      const result = await rpc.renderEntry(path);
      const title = result.entry.title ?? fallbackTitle ?? basename(path);
      setError(null);
      upsertTab({
        id: `entry:${path}`,
        kind: "entry",
        label: title,
        title,
        path,
        result,
      });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">{brandInitial(boot?.config)}</div>
          <div className="brand-copy">
            <strong>{boot?.config.config.workspace?.name ?? "Choral Forma"}</strong>
            <span>Configured workspace · powered by Choral Forma</span>
          </div>
        </div>
        <div className="status-strip">
          <StatusBadge status={boot?.check.status} label={statusLabel(boot?.check.status)} />
          <span className="pill">index {indexLabel(boot?.index.status)}</span>
          <span className="pill">{boot?.files.files.length ?? 0} files</span>
          <span className="pill">{views.length} views</span>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="rail" aria-label="Primary modes">
          <RailButton active={paneMode === "structured"} label="Structured" short="ST" onClick={() => setPaneMode("structured")} />
          <RailButton active={paneMode === "files"} label="Files" short="FL" onClick={() => setPaneMode("files")} />
          <RailButton active={paneMode === "inspect"} label="Inspect" short="IN" onClick={() => setPaneMode("inspect")} />
          <RailButton active={paneMode === "config"} label="Config" short="CF" onClick={() => setPaneMode("config")} />
          <RailButton active={paneMode === "diagnostics"} label="Diagnostics" short="DG" onClick={() => setPaneMode("diagnostics")} />
        </aside>

        <nav className="navigator" aria-label="Workspace navigation">
          <PanelHeader title={paneTitle(paneMode)} />
          <div className="panel-body">
            <input className="filter-input" placeholder="Filter current view" aria-label="Filter current view" />
            {paneMode === "structured" && (
              <>
                <NavItem active={activeId === "overview"} label="Overview" meta="home" onClick={() => setActiveId("overview")} />
                <SectionLabel label="Collections" />
                {collections.map((collection) => (
                  <NavItem
                    key={collection.id}
                    label={collection.title}
                    meta={String(collection.entryCount)}
                    onClick={() => void openCollection(collection.id, collection.title)}
                  />
                ))}
                <SectionLabel label="Views" />
                {views.map((view) => (
                  <NavItem
                    key={view.id}
                    label={view.title ?? view.id}
                    meta={view.mode}
                    onClick={() => void openView(view)}
                  />
                ))}
              </>
            )}
            {paneMode === "files" && (
              <>
                <SectionLabel label="Workspace Files" />
                {(boot?.files.files ?? []).map((file) => (
                  <NavItem
                    key={file.path}
                    label={file.title ?? file.path}
                    meta={file.kind}
                    onClick={() => {
                      if (file.kind === "entry") {
                        void openEntry(file.path, file.title);
                      }
                    }}
                  />
                ))}
              </>
            )}
            {paneMode === "inspect" && <KeyValueList rows={inspectRows(activeTab)} />}
            {paneMode === "config" && <KeyValueList rows={configRows(boot?.config)} />}
            {paneMode === "diagnostics" && <DiagnosticsList diagnostics={diagnostics} />}
          </div>
        </nav>

        <main className="main-surface">
          <div className="tabbar">
            <div className="tabs" aria-label="Open panes">
              {tabs.map((tab) => (
                <button
                  className={`tab ${tab.id === activeId ? "active" : ""}`}
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="tab-actions">
              <button className="small-button" type="button">SP</button>
              <button className="small-button" type="button">+</button>
            </div>
          </div>
          <div className="content-grid">
            <section className="tab-content">
              {error ? (
                <ErrorState message={error} />
              ) : (
                <TabContent tab={activeTab} boot={boot} openEntry={openEntry} openView={openView} />
              )}
            </section>
            <section className="bottom-panel" aria-label="References">
              <div className="bottom-tabs">
                <button className="bottom-tab active" type="button">Backlinks</button>
                <button className="bottom-tab" type="button">Outgoing</button>
                <button className="bottom-tab" type="button">Mentions</button>
                <button className="bottom-tab" type="button">Collapse</button>
              </div>
              <div className="bottom-content">
                <ReferencePanel tab={activeTab} files={boot?.files} openEntry={openEntry} />
              </div>
            </section>
          </div>
        </main>

        <aside className="inspector" aria-label="Inspector">
          <PanelHeader title="Inspector" />
          <div className="panel-body">
            <div className="inspector-tabs">
              <button className="small-button active" type="button">ToC</button>
              <button className="small-button" type="button">Props</button>
              <button className="small-button" type="button">Refs</button>
              <button className="small-button" type="button">Chat</button>
              <button className="small-button" type="button">Actions</button>
            </div>
            <SectionLabel label="Current Document" />
            <ol className="toc-list">
              {tocFor(activeTab).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <SectionLabel label="References" />
            <div className="note-box">References and document actions can occupy this panel after P0.</div>
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <span>Choral Forma · v0.1.0 · localhost</span>
        <span>workspace: {boot?.config.config.workspace?.name ?? "loading"} · mode: read-only · rpc: {error ? "failed" : "connected"}</span>
        <span>Help&nbsp;&nbsp;Docs&nbsp;&nbsp;Shortcuts</span>
      </footer>
    </div>
  );
}

function TabContent({
  tab,
  boot,
  openEntry,
  openView,
}: {
  tab: OpenTab;
  boot: BootState | null;
  openEntry: (path: string, fallbackTitle?: string) => Promise<void>;
  openView: (view: Pick<IndexView, "id" | "title">) => Promise<void>;
}) {
  if (!boot) {
    return <LoadingState />;
  }

  if (tab.kind === "overview") {
    const collections = collectCollections(boot.config, boot.files);
    const views = collectViews(boot.files);
    return (
      <article className="document">
        <DocumentHeader title="Workspace Overview" subtitle="A read-only operating surface for structured knowledge, source Markdown, rendered views, and diagnostics." status={boot.check.status} />
        <div className="metric-grid">
          <Metric value={collections.length} label="collections" />
          <Metric value={boot.files.files.filter((file) => file.kind === "entry").length} label="entries" />
          <Metric value={views.length} label="views" />
          <Metric value={boot.check.summary?.errors ?? 0} label="blocking diagnostics" />
        </div>
        <div className="two-column">
          <Card title="Recent Entries">
            <DataTable
              columns={["Title", "Collection", "Path"]}
              rows={boot.files.files
                .filter((file) => file.kind === "entry")
                .slice(0, 6)
                .map((file) => [file.title ?? basename(file.path), file.collection ?? "", file.path])}
              onRowClick={(row) => void openEntry(row[2] ?? "", row[0])}
            />
          </Card>
          <Card title="Views">
            <div className="link-list">
              {views.map((view) => (
                <button key={view.id} type="button" onClick={() => void openView(view)}>
                  <span>{view.title ?? view.id}</span>
                  <code>{view.mode}</code>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <DiagnosticsCard diagnostics={boot.check.diagnostics ?? []} />
      </article>
    );
  }

  if (tab.kind === "entry") {
    return (
      <article className="document">
        <DocumentHeader title={tab.title} subtitle={tab.path} status={tab.result.status} />
        <div className="rendered-html" dangerouslySetInnerHTML={{ __html: tab.result.render.html }} />
      </article>
    );
  }

  if (tab.kind === "collection") {
    return (
      <article className="document wide">
        <DocumentHeader title={tab.title} subtitle={tab.result.collection.include} status={tab.result.status} />
        <DataTable
          columns={["Title", "Kind", "Path"]}
          rows={tab.result.entries.map((entry) => [entry.title ?? basename(entry.path), entry.kind ?? "", entry.path])}
          onRowClick={(row) => void openEntry(row[2] ?? "", row[0])}
        />
      </article>
    );
  }

  return (
    <article className="document wide">
      <DocumentHeader
        title={tab.title}
        subtitle={`${tab.result.view?.mode ?? "view"} · ${tab.result.view?.path ?? ""}`}
        status={tab.result.status}
      />
      <ViewRender render={tab.result.render} openEntry={openEntry} />
    </article>
  );
}

function ViewRender({ render, openEntry }: { render?: ViewRenderOutput; openEntry: (path: string, title?: string) => Promise<void> }) {
  if (!render) {
    return <div className="empty-state">This view is indexed but does not have a P0 renderer yet.</div>;
  }
  if (render.kind === "table") {
    return (
      <DataTable
        columns={["Title", ...render.columns, "Path"]}
        rows={render.items.map((item) => [
          item.title ?? basename(item.path),
          ...render.columns.map((column) => formatValue(item.fields?.[column])),
          item.path,
        ])}
        onRowClick={(row) => void openEntry(row[row.length - 1] ?? "", row[0])}
      />
    );
  }
  return (
    <div className="kanban">
      {render.columns.map((column) => (
        <section className="kanban-column" key={column.id}>
          <header>{column.icon ? `${column.icon} ` : ""}{column.label}</header>
          {column.items.map((item) => (
            <button className="kanban-card" key={item.path} type="button" onClick={() => void openEntry(item.path, item.title)}>
              <strong>{item.title ?? basename(item.path)}</strong>
              <span>{item.path}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function ReferencePanel({ tab, files, openEntry }: { tab: OpenTab; files: FilesListResult | undefined; openEntry: (path: string, title?: string) => Promise<void> }) {
  if (tab.kind !== "entry") {
    return <p className="muted">Open a document to inspect backlinks and outgoing references.</p>;
  }
  const backlinks = files?.files.filter((file) => file.path !== tab.path && file.kind === "entry").slice(0, 4) ?? [];
  return (
    <div className="reference-list">
      {backlinks.map((file) => (
        <button key={file.path} type="button" onClick={() => void openEntry(file.path, file.title)}>
          <strong>{file.title ?? basename(file.path)}</strong>
          <span>{file.path}</span>
        </button>
      ))}
      {backlinks.length === 0 && <span className="muted">No relationship data is available yet.</span>}
    </div>
  );
}

function DataTable({ columns, rows, onRowClick }: { columns: string[]; rows: string[][]; onRowClick?: (row: string[]) => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => <th key={column}>{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.join(":")}-${index}`} onClick={() => onRowClick?.(row)}>
            {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function collectCollections(config: ConfigInspectResult | undefined, files: FilesListResult | undefined) {
  const collections = config?.config.collections ?? {};
  return Object.entries(collections).map(([id, value]) => {
    const data = value as { title?: string; include?: string };
    return {
      id,
      title: data.title ?? id,
      include: data.include ?? "",
      entryCount: files?.files.filter((file) => file.collection === id).length ?? 0,
    };
  });
}

function collectViews(files: FilesListResult | undefined): IndexView[] {
  return (files?.files ?? [])
    .filter((file) => file.kind === "view")
    .map((file) => ({
      id: file.path.replace(/^\.forma\/views\//, "").replace(/\.md$/, ""),
      path: file.path,
      surface: "page",
      mode: "view",
      title: file.title ?? basename(file.path),
    }));
}

function activeDiagnostics(tab: OpenTab | undefined): Diagnostic[] {
  if (!tab || tab.kind === "overview") {
    return [];
  }
  return tab.result.diagnostics ?? [];
}

function inspectRows(tab: OpenTab | undefined) {
  if (!tab) {
    return [];
  }
  if (tab.kind === "entry") {
    return [
      ["Path", tab.path],
      ["Collection", tab.result.entry.collection],
      ["Kind", tab.result.entry.kind ?? ""],
      ["References", String(tab.result.render.refs.length)],
    ];
  }
  if (tab.kind === "view") {
    return [
      ["View", tab.result.view?.id ?? ""],
      ["Mode", tab.result.view?.mode ?? ""],
      ["Path", tab.result.view?.path ?? ""],
      ["Status", tab.result.status],
    ];
  }
  return [["Pane", tab.title]];
}

function configRows(config: ConfigInspectResult | undefined) {
  return [
    ["Workspace", config?.config.workspace?.name ?? ""],
    ["Timezone", config?.config.workspace?.timezone ?? ""],
    ["Collections", Object.keys(config?.config.collections ?? {}).join(", ")],
    ["Overrides", config?.sources.find((source) => source.kind === "local")?.path ?? ""],
  ];
}

function tocFor(tab: OpenTab | undefined) {
  if (!tab) {
    return [];
  }
  if (tab.kind === "entry") {
    return [tab.title];
  }
  if (tab.kind === "view") {
    return [tab.title, tab.result.view?.mode ?? "View"];
  }
  return ["Workspace Overview", "Recent Entries", "Diagnostics"];
}

function KeyValueList({ rows }: { rows: string[][] }) {
  return (
    <dl className="kv-list">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DiagnosticsList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return <div className="empty-state">No diagnostics.</div>;
  }
  return (
    <div className="diagnostic-list">
      {diagnostics.map((diagnostic, index) => (
        <div className={`diagnostic ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
          <strong>{diagnostic.code}</strong>
          <span>{diagnostic.message}</span>
          {diagnostic.path && <code>{diagnostic.path}</code>}
        </div>
      ))}
    </div>
  );
}

function DiagnosticsCard({ diagnostics }: { diagnostics: Diagnostic[] }) {
  return (
    <Card title="Diagnostics">
      <DiagnosticsList diagnostics={diagnostics} />
    </Card>
  );
}

function DocumentHeader({ title, subtitle, status }: { title: string; subtitle: string; status: OperationStatus }) {
  return (
    <header className="doc-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="doc-badges">
        <StatusBadge status={status} label={statusLabel(status)} />
        <span className="pill">read only</span>
      </div>
    </header>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LoadingState() {
  return <div className="empty-state">Loading workspace through RPC...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="empty-state error">RPC failed: {message}</div>;
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="panel-head">
      <span>{title}</span>
      <button className="small-button" type="button">C</button>
    </div>
  );
}

function RailButton({ active, label, short, onClick }: { active: boolean; label: string; short: string; onClick: () => void }) {
  return (
    <button className={`rail-button ${active ? "active" : ""}`} type="button" title={label} onClick={onClick}>
      {short}
    </button>
  );
}

function NavItem({ active = false, label, meta, onClick }: { active?: boolean; label: string; meta?: string; onClick?: () => void }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span>{label}</span>
      {meta && <code>{meta}</code>}
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <h3 className="section-label">{label}</h3>;
}

function StatusBadge({ status, label }: { status: OperationStatus | undefined; label: string }) {
  return <span className={`pill status ${status ?? "warning"}`}>{label}</span>;
}

function paneTitle(mode: PaneMode) {
  return {
    structured: "Structured",
    files: "Files",
    inspect: "Inspect",
    config: "Config",
    diagnostics: "Diagnostics",
  }[mode];
}

function statusLabel(status: OperationStatus | undefined) {
  if (!status) {
    return "loading";
  }
  return status === "passed" ? "check passed" : status === "warning" ? "warnings" : "check failed";
}

function indexLabel(status: OperationStatus | undefined) {
  if (!status) {
    return "loading";
  }
  return status === "passed" ? "current" : status;
}

function brandInitial(config: ConfigInspectResult | undefined) {
  return (config?.config.workspace?.name ?? "Forma").trim().charAt(0).toUpperCase();
}

function basename(path: string) {
  return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
}

function formatValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
