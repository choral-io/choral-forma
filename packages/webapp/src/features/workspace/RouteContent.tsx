import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyPage() {
    return <EmptyState description="No page has been designed for this route yet." icon={FileText} title="Not found" />;
}

export function EmptyState({
    description,
    icon: Icon,
    title,
}: {
    description: string;
    icon: typeof FileText;
    title: string;
}) {
    return (
        <section className="card border border-base-300 bg-base-100">
            <div className="card-body">
                <div className="flex size-10 items-center justify-center rounded-md bg-base-200 text-base-content/60">
                    <Icon data-icon="inline-start" />
                </div>
                <h2 className="card-title">{title}</h2>
                <p className="text-sm text-base-content/60">{description}</p>
            </div>
        </section>
    );
}

export function RouteBodySection({
    children,
    description,
    meta,
    title,
}: {
    children: ReactNode;
    description: string;
    meta?: string;
    title: string;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
                    <p className="mt-1 text-sm/6 text-base-content/60">{description}</p>
                </div>
                {meta && <span className="text-sm text-base-content/60">{meta}</span>}
            </div>
            {children}
        </section>
    );
}
