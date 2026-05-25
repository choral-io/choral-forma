import { ArrowUpRight, FileText, GitPullRequestDraft, Network, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
    DashboardCollection,
    DashboardDocument,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "@/data/workspace-client";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";

export function DashboardHome({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <main className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-background/80 flex items-center justify-between border-b px-8 py-4 backdrop-blur">
                <div>
                    <p className="text-muted-foreground text-sm">Choral Forma</p>
                    <h1 className="text-2xl font-semibold tracking-normal">{dashboard.workspaceName}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Search data-icon="inline-start" />
                        Search
                    </Button>
                    <Button variant="secondary">
                        <GitPullRequestDraft data-icon="inline-start" />
                        New proposal
                    </Button>
                </div>
            </header>
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_22rem] gap-6 overflow-auto p-8">
                <section className="flex min-w-0 flex-col gap-6">
                    <Hero dashboard={dashboard} />
                    <Tabs defaultValue="collections">
                        <TabsList>
                            <TabsTrigger value="collections">Collections</TabsTrigger>
                            <TabsTrigger value="documents">Documents</TabsTrigger>
                            <TabsTrigger value="views">Views</TabsTrigger>
                        </TabsList>
                        <TabsContent value="collections">
                            <div className="grid grid-cols-2 gap-4">
                                {dashboard.collections.map((collection) => (
                                    <CollectionCard collection={collection} key={collection.id} />
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="documents">
                            <div className="grid gap-3">
                                {dashboard.recentDocuments.map((document) => (
                                    <DocumentRow document={document} key={document.path} />
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="views">
                            <div className="grid grid-cols-3 gap-4">
                                {dashboard.views.map((view) => (
                                    <Card key={view.id}>
                                        <CardHeader>
                                            <Badge variant="outline">{view.kind}</Badge>
                                            <CardTitle>{view.title}</CardTitle>
                                            <CardDescription>{view.description}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </section>
                <aside className="flex min-w-0 flex-col gap-6">
                    <DiagnosticsPanel diagnostics={dashboard.diagnostics} />
                    <Card>
                        <CardHeader>
                            <CardTitle>Proposal Queue</CardTitle>
                            <CardDescription>
                                Write-adjacent actions will become reviewable operation proposals.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full" variant="outline">
                                <GitPullRequestDraft data-icon="inline-start" />
                                Review proposal model
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Chat</CardTitle>
                            <CardDescription>
                                Explain, diagnose, draft, and propose modes are reserved for the next design task.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </aside>
            </div>
        </main>
    );
}

function Hero({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <section className="border-border bg-card rounded-lg border p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
                <div className="max-w-2xl">
                    <Badge variant={healthVariant(dashboard.status)}>{dashboard.status}</Badge>
                    <h2 className="mt-4 text-3xl font-semibold tracking-normal">
                        A read-oriented workspace dashboard for repository knowledge.
                    </h2>
                    <p className="text-muted-foreground mt-3 text-sm leading-6">{dashboard.tagline}</p>
                </div>
                <div className="grid w-72 grid-cols-2 gap-3">
                    <Metric icon={FileText} label="Documents" value={dashboard.recentDocuments.length} />
                    <Metric icon={ShieldCheck} label="Findings" value={dashboard.diagnostics.length} />
                    <Metric icon={Network} label="Views" value={dashboard.views.length} />
                    <Metric icon={ArrowUpRight} label="Spaces" value={dashboard.collections.length} />
                </div>
            </div>
        </section>
    );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
    return (
        <div className="border-border bg-background rounded-lg border p-3">
            <Icon className="text-muted-foreground" data-icon="inline-start" />
            <strong className="mt-3 block text-2xl">{value}</strong>
            <span className="text-muted-foreground text-xs">{label}</span>
        </div>
    );
}

function CollectionCard({ collection }: { collection: DashboardCollection }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>{collection.title}</CardTitle>
                    <Badge variant={healthVariant(collection.status)}>{collection.entryCount}</Badge>
                </div>
                <CardDescription>{collection.description}</CardDescription>
            </CardHeader>
        </Card>
    );
}

function DocumentRow({ document }: { document: DashboardDocument }) {
    return (
        <article className="border-border bg-card flex items-center gap-4 rounded-lg border p-4 shadow-sm">
            <div className="bg-muted flex size-10 items-center justify-center rounded-md">
                <FileText data-icon="inline-start" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{document.title}</h3>
                <p className="text-muted-foreground truncate text-sm">{document.summary}</p>
            </div>
            <Badge variant="outline">{document.collection}</Badge>
            <span className="text-muted-foreground text-xs">{document.updatedLabel}</span>
        </article>
    );
}

function healthVariant(status: WorkspaceHealth) {
    return status === "healthy" ? "success" : status === "warning" ? "warning" : "destructive";
}
