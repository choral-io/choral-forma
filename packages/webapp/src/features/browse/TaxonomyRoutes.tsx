import { ArrowRight, FileText, Layers3 } from "lucide-react";
import { Link, useParams } from "react-router";

import type { DashboardTaxonomy, DashboardTaxonomyTerm, WorkspaceDashboard } from "@/data/workspace-client";
import { EmptyPage, EmptyState, RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { taxonomyRoutePath, taxonomyTermRoutePath } from "@/lib/workspace-routes";

import { PagesList } from "./PagesList";

export function TaxonomiesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame
            description="Taxonomies and terms declared by workspace configuration."
            eyebrow="Workspace"
            title="Browse"
        >
            <TaxonomiesPage dashboard={dashboard} />
        </WorkspaceRouteFrame>
    );
}

export function TaxonomyRoute() {
    const dashboard = useWorkspaceDashboard();
    const { taxonomyId } = useParams();
    const taxonomy = dashboard.taxonomies.find((item) => item.id === taxonomyId);

    if (!taxonomy) {
        return (
            <WorkspaceRouteFrame eyebrow="Browse" title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame description={taxonomy.description} eyebrow="Browse" title={taxonomy.title}>
            <TaxonomyPage taxonomy={taxonomy} />
        </WorkspaceRouteFrame>
    );
}

export function TaxonomyTermRoute() {
    const dashboard = useWorkspaceDashboard();
    const { taxonomyId, termId } = useParams();
    const taxonomy = dashboard.taxonomies.find((item) => item.id === taxonomyId);
    const term = taxonomy?.terms.find((item) => item.id === termId);

    if (!taxonomy || !term) {
        return (
            <WorkspaceRouteFrame eyebrow="Browse" title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame description={term.description} eyebrow={taxonomy.title} title={term.title}>
            <TaxonomyTermPage taxonomy={taxonomy} term={term} />
        </WorkspaceRouteFrame>
    );
}

function TaxonomiesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <RouteBodySection
            description="Choose a configured taxonomy to browse its terms and matching content."
            meta={`${String(dashboard.taxonomies.length)} taxonomies`}
            title="Configured taxonomies"
        >
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
        <RouteBodySection
            description="Terms declared for this configured taxonomy."
            meta={`${String(taxonomy.terms.length)} terms`}
            title="Configured terms"
        >
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

function TaxonomyTermPage({ taxonomy, term }: { taxonomy: DashboardTaxonomy; term: DashboardTaxonomyTerm }) {
    return (
        <RouteBodySection
            description={`Content matched by the configured ${taxonomy.title} term.`}
            meta={`${String(term.entries.length)} entries`}
            title="Matching content"
        >
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

function TaxonomiesGrid({ taxonomies }: { taxonomies: DashboardTaxonomy[] }) {
    return (
        <nav aria-label="Configured taxonomies" className="divide-y divide-base-300 border-y border-base-300">
            {taxonomies.map((taxonomy) => (
                <Link
                    className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                    key={taxonomy.id}
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
            ))}
        </nav>
    );
}

function TaxonomyTermsGrid({ taxonomy }: { taxonomy: DashboardTaxonomy }) {
    return (
        <nav aria-label={`${taxonomy.title} terms`} className="divide-y divide-base-300 border-y border-base-300">
            {taxonomy.terms.map((term) => (
                <Link
                    className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                    key={term.id}
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
            ))}
        </nav>
    );
}
