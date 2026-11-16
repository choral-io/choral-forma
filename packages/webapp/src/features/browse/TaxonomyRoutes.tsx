import { ArrowRight, FileText, Layers3 } from "lucide-react";
import { Link, useLocation } from "react-router";

import { canonicalRoutePath } from "@/data/static-route-target";
import type { DashboardTaxonomy, DashboardTaxonomyTerm, WorkspaceDashboard } from "@/data/workspace-client";
import { EmptyPage, EmptyState, RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { browseRoutePath, taxonomyRoutePath, taxonomyTermRoutePath } from "@/lib/workspace-routes";

import { PagesList } from "./PagesList";

const collectionsBreadcrumb = [{ label: "Collections", to: browseRoutePath }];

export function TaxonomiesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame
            contentWidth="narrow"
            description="Taxonomies and terms declared by workspace configuration."
            title="Collections"
        >
            <TaxonomiesPage dashboard={dashboard} />
        </WorkspaceRouteFrame>
    );
}

export function TaxonomyRoute() {
    const dashboard = useWorkspaceDashboard();
    const { pathname } = useLocation();
    const routePath = canonicalRoutePath(pathname);
    const taxonomy = dashboard.taxonomies.find((item) => taxonomyRoutePath(item.id) === routePath);

    if (!taxonomy) {
        return (
            <WorkspaceRouteFrame contentWidth="narrow" breadcrumb={collectionsBreadcrumb} title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame
            contentWidth="narrow"
            breadcrumb={collectionsBreadcrumb}
            description={taxonomy.description}
            title={taxonomy.title}
        >
            <TaxonomyPage taxonomy={taxonomy} />
        </WorkspaceRouteFrame>
    );
}

export function TaxonomyTermRoute() {
    const dashboard = useWorkspaceDashboard();
    const { pathname } = useLocation();
    const routePath = canonicalRoutePath(pathname);
    // Router params collapse a literal `%2F` into `/`; compare encoded paths instead.
    const taxonomy = dashboard.taxonomies.find((item) => routePath.startsWith(`${taxonomyRoutePath(item.id)}/`));
    const term = taxonomy?.terms.find((item) => taxonomyTermRoutePath(taxonomy.id, item.id) === routePath);

    if (!taxonomy || !term) {
        return (
            <WorkspaceRouteFrame contentWidth="narrow" breadcrumb={collectionsBreadcrumb} title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame
            contentWidth="narrow"
            breadcrumb={[...collectionsBreadcrumb, { label: taxonomy.title, to: taxonomyRoutePath(taxonomy.id) }]}
            description={term.description}
            title={term.title}
        >
            <TaxonomyTermPage term={term} />
        </WorkspaceRouteFrame>
    );
}

function TaxonomiesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <RouteBodySection meta={`${String(dashboard.taxonomies.length)} taxonomies`}>
            {dashboard.taxonomies.length > 0 ? (
                <TaxonomiesGrid taxonomies={dashboard.taxonomies} />
            ) : (
                <p className="py-8 text-sm text-base-content/60">No taxonomies are configured.</p>
            )}
        </RouteBodySection>
    );
}

function TaxonomyPage({ taxonomy }: { taxonomy: DashboardTaxonomy }) {
    return (
        <RouteBodySection meta={`${String(taxonomy.terms.length)} terms`}>
            {taxonomy.terms.length > 0 ? (
                <TaxonomyTermsGrid taxonomy={taxonomy} />
            ) : (
                <EmptyState
                    description="Add the first configured term, then verify the workspace configuration."
                    icon={Layers3}
                    title="No terms"
                />
            )}
        </RouteBodySection>
    );
}

function TaxonomyTermPage({ term }: { term: DashboardTaxonomyTerm }) {
    return (
        <RouteBodySection meta={`${String(term.entries.length)} entries`}>
            {term.entries.length > 0 ? (
                <PagesList entries={term.entries} />
            ) : (
                <EmptyState
                    description="No Markdown content currently matches this configured term."
                    icon={FileText}
                    title="No matching content"
                />
            )}
        </RouteBodySection>
    );
}

// Index lists are labelled lists, not navigation landmarks; the explicit role survives removed list markers in Safari.
function TaxonomiesGrid({ taxonomies }: { taxonomies: DashboardTaxonomy[] }) {
    return (
        <ul aria-label="Taxonomies" className="divide-y divide-base-300 border-y border-base-300" role="list">
            {taxonomies.map((taxonomy) => (
                <li key={taxonomy.id}>
                    <Link
                        className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                        to={taxonomyRoutePath(taxonomy.id)}
                    >
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{taxonomy.title}</span>
                                <span className="badge badge-outline badge-sm">{taxonomy.mode}</span>
                            </div>
                            <p className="mt-1 truncate text-sm text-base-content/60">{taxonomy.description}</p>
                        </div>
                        <div className="hidden gap-4 text-sm text-base-content/60 sm:flex">
                            <span>{taxonomy.terms.length} terms</span>
                            <span>{taxonomy.terms.reduce((total, term) => total + term.entryCount, 0)} entries</span>
                        </div>
                        <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-base-content/50" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function TaxonomyTermsGrid({ taxonomy }: { taxonomy: DashboardTaxonomy }) {
    return (
        <ul
            aria-label={`${taxonomy.title} terms`}
            className="divide-y divide-base-300 border-y border-base-300"
            role="list"
        >
            {taxonomy.terms.map((term) => (
                <li key={term.id}>
                    <Link
                        className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                        to={taxonomyTermRoutePath(taxonomy.id, term.id)}
                    >
                        <div className="min-w-0">
                            <span className="font-medium">{term.title}</span>
                            <p className="mt-1 truncate text-sm text-base-content/60">{term.description}</p>
                        </div>
                        <span className="hidden text-sm text-base-content/60 tabular-nums sm:block">
                            {term.entryCount} {term.entryCount === 1 ? "entry" : "entries"}
                        </span>
                        <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-base-content/50" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
