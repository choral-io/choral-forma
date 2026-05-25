import { AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardDiagnostic } from "@/data/workspace-client";

export function DiagnosticsPanel({ diagnostics }: { diagnostics: DashboardDiagnostic[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Knowledge Health</CardTitle>
                <CardDescription>Read-only signals from workspace checks and planned V2 surfaces.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {diagnostics.map((diagnostic) => (
                    <article
                        className="border-border bg-background flex gap-3 rounded-md border p-3"
                        key={diagnostic.code}
                    >
                        <div className="text-muted-foreground mt-0.5">
                            {diagnostic.severity === "info" ? (
                                <Info data-icon="inline-start" />
                            ) : (
                                <AlertTriangle data-icon="inline-start" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={
                                        diagnostic.severity === "warning"
                                            ? "warning"
                                            : diagnostic.severity === "error"
                                              ? "destructive"
                                              : "secondary"
                                    }
                                >
                                    {diagnostic.code}
                                </Badge>
                                <span className="text-muted-foreground text-xs">{diagnostic.severity}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6">{diagnostic.message}</p>
                            {diagnostic.path && (
                                <code className="text-muted-foreground mt-2 block truncate text-xs">
                                    {diagnostic.path}
                                </code>
                            )}
                        </div>
                    </article>
                ))}
            </CardContent>
        </Card>
    );
}
