import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  type CheckResult,
  type ConfigInspectResult,
  type Diagnostic,
  type FileReferencesResult,
  type FileRenderResult,
  type FilesListResult,
  FormaRpcClient,
  type IndexView,
  type ListResult,
  type OperationStatus,
  type ReferenceEdge,
  type ViewRenderOutput,
  type ViewRenderResult,
  type WorkspaceFile,
  type WorkspaceFileFeature,
} from "@choral-forma/shared";

import "./App.css";

const rpc = new FormaRpcClient(import.meta.env.VITE_FORMA_RPC_URL ?? defaultRpcUrl());
const overviewTab: OpenTab = {
  id: "overview",
  kind: "overview",
  label: "Overview",
  title: "Workspace Overview",
};

type PaneMode = "structured" | "files" | "inspect" | "config" | "diagnostics";
type FilePreviewMode = "rendered" | "source" | "media";

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
      kind: "file";
      label: string;
      title: string;
      path: string;
      mode: FilePreviewMode;
      canRender: boolean;
      file?: WorkspaceFile;
      rendered?: FileRenderResult;
      source?: FileRenderResult;
      references?: FileReferencesResult;
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
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [expandedFileDirectories, setExpandedFileDirectories] = useState<Set<string>>(new Set());
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
  const filesByPath = useMemo(() => {
    return new Map((boot?.files?.files ?? []).map((file) => [file.path, file]));
  }, [boot?.files?.files]);
  const visibleFiles = useMemo(
    () => filterFiles(boot?.files?.files ?? [], showHiddenFiles),
    [boot?.files?.files, showHiddenFiles],
  );
  const fileTree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);
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

  async function openFile(path: string, fallbackTitle?: string) {
    try {
      const file = filesByPath.get(path);
      if (fileHasFeature(file, "render.view")) {
        const view = views.find((candidate) => candidate.path === path);
        if (view) {
          await openView(view);
          return;
        }
      }
      if (fileHasFeature(file, "preview.media") && file) {
        setError(null);
        upsertTab({
          id: `file:${path}`,
          kind: "file",
          label: fallbackTitle ?? file.title ?? file.name,
          title: fallbackTitle ?? file.title ?? file.name,
          path,
          mode: "media",
          canRender: false,
          file,
        });
        return;
      }
      const canRender = fileHasFeature(file, "render.html");
      const rendered = canRender ? await rpc.renderFile(path) : undefined;
      const source = fileHasFeature(file, "render.source") || canRender ? await renderSource(path) : undefined;
      const sourceResult = source ?? rendered;
      if (!sourceResult) {
        throw new Error(`Preview is unavailable for ${path}.`);
      }
      const fileCollection = rendered?.file.collection ?? sourceResult.file.collection ?? file?.collection;
      const references = file?.kind === "knowledge" || fileCollection ? await rpc.listFileReferences(path) : undefined;
      const title =
        rendered?.file.title ??
        (canRender ? source?.file.title : undefined) ??
        fallbackTitle ??
        file?.name ??
        basename(path);
      setError(null);
      upsertTab({
        id: `file:${path}`,
        kind: "file",
        label: title,
        title,
        path,
        mode: canRender ? "rendered" : "source",
        canRender,
        rendered,
        source: sourceResult,
        references,
      });
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function renderSource(path: string) {
    const source = await rpc.renderFile(path, "source");
    if (!isFileRenderResult(source)) {
      throw new Error(`Source preview is unavailable for ${path}.`);
    }
    return source;
  }

  function setFilePreviewMode(path: string, mode: FilePreviewMode) {
    setTabs((current) =>
      current.map((tab) => {
        if (tab.kind !== "file" || tab.path !== path) {
          return tab;
        }
        if (mode === "source" && !tab.source) {
          return tab;
        }
        if (mode === "media" && !tab.file) {
          return tab;
        }
        if (mode === "rendered" && !tab.canRender) {
          return tab;
        }
        return { ...tab, mode };
      }),
    );
  }

  function toggleFileDirectory(path: string) {
    setExpandedFileDirectories((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
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
                <label className="toggle-row">
                  <input
                    checked={showHiddenFiles}
                    onChange={(event) => setShowHiddenFiles(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>Show hidden files</span>
                </label>
                <SectionLabel label="Workspace Files" />
                <FileTreeView
                  directories={fileTree.directories}
                  expandedDirectories={expandedFileDirectories}
                  files={fileTree.files}
                  onOpenFile={openFile}
                  onToggleDirectory={toggleFileDirectory}
                />
                {fileTree.directories.length === 0 && fileTree.files.length === 0 && (
                  <div className="empty-state compact">No files.</div>
                )}
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
                <TabContent tab={activeTab} boot={boot} openFile={openFile} openView={openView} setFilePreviewMode={setFilePreviewMode} />
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
                <ReferencePanel tab={activeTab} openFile={openFile} />
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
  openFile,
  openView,
  setFilePreviewMode,
}: {
  tab: OpenTab;
  boot: BootState | null;
  openFile: (path: string, fallbackTitle?: string) => Promise<void>;
  openView: (view: Pick<IndexView, "id" | "title">) => Promise<void>;
  setFilePreviewMode: (path: string, mode: FilePreviewMode) => void;
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
          <Metric value={boot.files.files.filter((file) => file.kind === "knowledge").length} label="entries" />
          <Metric value={views.length} label="views" />
          <Metric value={boot.check.summary?.errors ?? 0} label="blocking diagnostics" />
        </div>
        <div className="two-column">
          <Card title="Recent Entries">
            <DataTable
              columns={["Title", "Collection", "Path"]}
              rows={boot.files.files
                .filter((file) => file.kind === "knowledge")
                .slice(0, 6)
                .map((file) => [file.title ?? basename(file.path), file.collection ?? "", file.path])}
              onRowClick={(row) => void openFile(row[2] ?? "", row[0])}
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

  if (tab.kind === "file") {
    const result = activeFileResult(tab);
    return (
      <article className="document">
        <DocumentHeader title={tab.title} subtitle={tab.path} status={result?.status ?? "passed"}>
          {tab.mode !== "media" && (
            <PreviewSwitch
              canRender={tab.canRender}
              canSource={Boolean(tab.source)}
              mode={tab.mode}
              onChange={(mode) => setFilePreviewMode(tab.path, mode)}
            />
          )}
        </DocumentHeader>
        {tab.mode === "media" && tab.file ? (
          <MediaPreview file={tab.file} />
        ) : tab.mode === "source" ? (
          <pre className="source-view"><code>{tab.source?.render.source ?? ""}</code></pre>
        ) : (
          <div
            className="rendered-html"
            dangerouslySetInnerHTML={{ __html: rewriteWorkspaceHrefs(tab.rendered?.render.html ?? "") }}
            onClick={(event) => void handleRenderedLinkClick(event, openFile)}
          />
        )}
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
          onRowClick={(row) => void openFile(row[2] ?? "", row[0])}
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
      <ViewRender render={tab.result.render} openFile={openFile} />
    </article>
  );
}

function ViewRender({ render, openFile }: { render?: ViewRenderOutput; openFile: (path: string, title?: string) => Promise<void> }) {
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
        onRowClick={(row) => void openFile(row[row.length - 1] ?? "", row[0])}
      />
    );
  }
  return (
    <div className="kanban">
      {render.columns.map((column) => (
        <section className="kanban-column" key={column.id}>
          <header>{column.icon ? `${column.icon} ` : ""}{column.label}</header>
          {column.items.map((item) => (
            <button className="kanban-card" key={item.path} type="button" onClick={() => void openFile(item.path, item.title)}>
              <strong>{item.title ?? basename(item.path)}</strong>
              <span>{item.path}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function ReferencePanel({ tab, openFile }: { tab: OpenTab; openFile: (path: string, title?: string) => Promise<void> }) {
  if (tab.kind !== "file") {
    return <p className="muted">Open a document to inspect backlinks and outgoing references.</p>;
  }
  if (!tab.references) {
    return <p className="muted">No relationship data is available for this file.</p>;
  }
  return (
    <div className="reference-list">
      <ReferenceGroup label="Backlinks" edges={tab.references.backlinks} direction="source" openFile={openFile} />
      <ReferenceGroup label="Outgoing" edges={tab.references.outgoing} direction="target" openFile={openFile} />
    </div>
  );
}

function ReferenceGroup({
  label,
  edges,
  direction,
  openFile,
}: {
  label: string;
  edges: ReferenceEdge[];
  direction: "source" | "target";
  openFile: (path: string, title?: string) => Promise<void>;
}) {
  return (
    <section className="reference-group">
      <h3>{label}</h3>
      {edges.map((edge) => {
        const path = direction === "source" ? edge.sourcePath : edge.targetPath;
        const title = direction === "source" ? edge.sourceTitle : edge.targetTitle;
        return (
          <button key={`${edge.sourcePath}->${edge.targetPath}:${edge.intent}:${edge.field ?? ""}`} type="button" onClick={() => void openFile(path, title)}>
            <strong>{title ?? basename(path)}</strong>
            <span>{edge.intent} · {path}</span>
          </button>
        );
      })}
      {edges.length === 0 && <span className="muted">None.</span>}
    </section>
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

function filterFiles(files: WorkspaceFile[], showHidden: boolean) {
  return showHidden ? files : files.filter((file) => !isHiddenWorkspacePath(file.path));
}

type DirectoryListItem = {
  path: string;
  name: string;
};

type FileTreeDirectory = DirectoryListItem & {
  directories: FileTreeDirectory[];
  files: WorkspaceFile[];
};

type FileTree = {
  directories: FileTreeDirectory[];
  files: WorkspaceFile[];
};

function buildFileTree(files: WorkspaceFile[]): FileTree {
  const root: FileTree = { directories: [], files: [] };
  const directories = new Map<string, FileTreeDirectory>();

  function ensureDirectory(path: string): FileTreeDirectory {
    const existing = directories.get(path);
    if (existing) {
      return existing;
    }
    const parentPath = parentFromWorkspacePath(path);
    const directory: FileTreeDirectory = {
      path,
      name: basename(path),
      directories: [],
      files: [],
    };
    directories.set(path, directory);
    if (parentPath) {
      ensureDirectory(parentPath).directories.push(directory);
    } else {
      root.directories.push(directory);
    }
    return directory;
  }

  for (const file of files) {
    if (!file.parent) {
      root.files.push(file);
      continue;
    }
    ensureDirectory(file.parent).files.push(file);
  }
  sortFileTree(root);
  return root;
}

function sortFileTree(tree: FileTree) {
  tree.directories.sort((left, right) => left.name.localeCompare(right.name));
  tree.files.sort((left, right) => left.name.localeCompare(right.name));
  for (const directory of tree.directories) {
    sortFileTree(directory);
  }
}

function parentFromWorkspacePath(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function FileTreeView({
  directories,
  expandedDirectories,
  files,
  onOpenFile,
  onToggleDirectory,
}: FileTree & {
  expandedDirectories: Set<string>;
  onOpenFile: (path: string, fallbackTitle?: string) => Promise<void>;
  onToggleDirectory: (path: string) => void;
}) {
  return (
    <>
      {directories.map((directory) => (
        <FileTreeDirectoryRow
          directory={directory}
          depth={0}
          expandedDirectories={expandedDirectories}
          key={directory.path}
          onOpenFile={onOpenFile}
          onToggleDirectory={onToggleDirectory}
        />
      ))}
      {files.map((file) => (
        <FileTreeFileRow depth={0} file={file} key={file.path} onOpenFile={onOpenFile} />
      ))}
    </>
  );
}

function FileTreeDirectoryRow({
  directory,
  depth,
  expandedDirectories,
  onOpenFile,
  onToggleDirectory,
}: {
  directory: FileTreeDirectory;
  depth: number;
  expandedDirectories: Set<string>;
  onOpenFile: (path: string, fallbackTitle?: string) => Promise<void>;
  onToggleDirectory: (path: string) => void;
}) {
  const expanded = expandedDirectories.has(directory.path);
  const directoryDetail =
    directory.path === directory.name
      ? `${directory.directories.length + directory.files.length} items`
      : directory.path;
  return (
    <>
      <button
        aria-expanded={expanded}
        className="file-tree-row directory"
        onClick={() => onToggleDirectory(directory.path)}
        style={{ "--file-tree-depth": depth } as CSSProperties}
        type="button"
      >
        <span className="file-tree-caret">{expanded ? "v" : ">"}</span>
        <span className="file-tree-copy">
          <strong>{directory.name}</strong>
          <span>{directoryDetail}</span>
        </span>
        <code>folder</code>
      </button>
      {expanded && (
        <>
          {directory.directories.map((child) => (
            <FileTreeDirectoryRow
              directory={child}
              depth={depth + 1}
              expandedDirectories={expandedDirectories}
              key={child.path}
              onOpenFile={onOpenFile}
              onToggleDirectory={onToggleDirectory}
            />
          ))}
          {directory.files.map((file) => (
            <FileTreeFileRow depth={depth + 1} file={file} key={file.path} onOpenFile={onOpenFile} />
          ))}
          {directory.directories.length === 0 && directory.files.length === 0 && (
            <div
              className="file-tree-empty"
              style={{ "--file-tree-depth": depth + 1 } as CSSProperties}
            >
              Empty folder
            </div>
          )}
        </>
      )}
    </>
  );
}

function FileTreeFileRow({
  depth,
  file,
  onOpenFile,
}: {
  depth: number;
  file: WorkspaceFile;
  onOpenFile: (path: string, fallbackTitle?: string) => Promise<void>;
}) {
  const title = displayableTitle(file.title) ?? frontmatterTitle(file);
  const detail = title && title !== file.name ? title : file.path;
  return (
    <button
      className="file-tree-row file"
      onClick={() => void onOpenFile(file.path, title)}
      style={{ "--file-tree-depth": depth } as CSSProperties}
      type="button"
    >
      <span className="file-tree-caret" />
      <span className="file-tree-copy">
        <strong>{file.name}</strong>
        <span>{detail}</span>
      </span>
      <code>{file.collection ?? file.kind}</code>
    </button>
  );
}

function fileHasFeature(file: WorkspaceFile | undefined, feature: WorkspaceFileFeature) {
  return file?.features.includes(feature) ?? false;
}

function frontmatterTitle(file: WorkspaceFile | undefined) {
  const title = file?.frontmatter?.title;
  return typeof title === "string" ? displayableTitle(title) : undefined;
}

function displayableTitle(title: string | undefined) {
  const trimmed = title?.trim();
  return trimmed && !isPlaceholderTitle(trimmed) ? title : undefined;
}

function isPlaceholderTitle(title: string) {
  return /^\{\{\s*[^}]+?\s*\}\}$/.test(title);
}

function isHiddenWorkspacePath(path: string) {
  return path.split("/").some((part) => part.startsWith("."));
}

function isFileRenderResult(result: unknown): result is FileRenderResult {
  const candidate = result as Partial<FileRenderResult> | undefined;
  return (
    candidate?.operation === "file.render" &&
    typeof candidate.file?.path === "string" &&
    typeof candidate.render?.format === "string"
  );
}

function activeFileResult(tab: Extract<OpenTab, { kind: "file" }>) {
  return tab.mode === "rendered" && tab.rendered ? tab.rendered : (tab.source ?? tab.rendered);
}

function MediaPreview({ file }: { file: WorkspaceFile }) {
  const src = new URL(`raw/${file.path.split("/").map(encodeURIComponent).join("/")}`, document.baseURI).toString();
  if (file.mediaType.startsWith("image/")) {
    return <img className="media-preview image" src={src} alt={file.name} />;
  }
  if (file.mediaType.startsWith("audio/")) {
    return <audio className="media-preview" controls src={src} />;
  }
  if (file.mediaType.startsWith("video/")) {
    return <video className="media-preview video" controls src={src} />;
  }
  return <div className="empty-state">Preview is unavailable for this media type.</div>;
}

async function handleRenderedLinkClick(
  event: MouseEvent<HTMLDivElement>,
  openFile: (path: string, fallbackTitle?: string) => Promise<void>,
) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const link = target.closest("a[href]");
  if (!link || !event.currentTarget.contains(link)) {
    return;
  }
  const path = workspaceMarkdownPath(link.getAttribute("href"));
  if (!path) {
    return;
  }
  event.preventDefault();
  await openFile(path, link.textContent?.trim() || undefined);
}

function workspaceMarkdownPath(href: string | null) {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      return null;
    }
    const basePath = currentAppBasePath();
    let pathname = url.pathname;
    if (basePath && pathname.startsWith(`${basePath}/`)) {
      pathname = pathname.slice(basePath.length);
    }
    const path = decodeURIComponent(pathname.replace(/^\/+/, ""));
    return path.endsWith(".md") ? path : null;
  } catch {
    return null;
  }
}

function rewriteWorkspaceHrefs(html: string) {
  const basePath = currentAppBasePath();
  if (!basePath) {
    return html;
  }
  return html.replace(/href="\/([^":?#][^"#?]*\.md(?:#[^"]*)?)"/g, `href="${basePath}/$1"`);
}

function currentAppBasePath() {
  const path = new URL(document.baseURI).pathname;
  if (path === "/") {
    return "";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path.replace(/\/[^/]*$/, "");
}

function defaultRpcUrl() {
  return new URL("rpc", document.baseURI).toString();
}

function activeDiagnostics(tab: OpenTab | undefined): Diagnostic[] {
  if (!tab || tab.kind === "overview") {
    return [];
  }
  if (tab.kind === "file") {
    return activeFileResult(tab)?.diagnostics ?? [];
  }
  return tab.result.diagnostics ?? [];
}

function inspectRows(tab: OpenTab | undefined) {
  if (!tab) {
    return [];
  }
  if (tab.kind === "file") {
    const result = activeFileResult(tab);
    return [
      ["Path", tab.path],
      ["Mode", tab.mode],
      ["Collection", result?.file.collection ?? tab.file?.collection ?? ""],
      ["Kind", result?.file.kind ?? tab.file?.kind ?? ""],
      ["References", String(result?.render.refs.length ?? 0)],
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
  if (tab.kind === "file") {
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

function DocumentHeader({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  status: OperationStatus;
  children?: ReactNode;
}) {
  return (
    <header className="doc-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="doc-badges">
        {children}
        <StatusBadge status={status} label={statusLabel(status)} />
        <span className="pill">read only</span>
      </div>
    </header>
  );
}

function PreviewSwitch({
  canRender,
  canSource,
  mode,
  onChange,
}: {
  canRender: boolean;
  canSource: boolean;
  mode: FilePreviewMode;
  onChange: (mode: FilePreviewMode) => void;
}) {
  return (
    <div className="preview-switch" aria-label="Preview mode">
      <button
        className={mode === "rendered" ? "active" : ""}
        disabled={!canRender}
        onClick={() => onChange("rendered")}
        title={canRender ? "Rendered preview" : "Rendered preview unavailable"}
        type="button"
      >
        Rendered
      </button>
      <button
        className={mode === "source" ? "active" : ""}
        disabled={!canSource}
        onClick={() => onChange("source")}
        type="button"
      >
        Source
      </button>
    </div>
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
