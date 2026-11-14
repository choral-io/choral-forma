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

/** A list page's single body: the list itself, with an optional count beside it. */
export function RouteBodySection({ children, meta }: { children: ReactNode; meta?: string }) {
    return (
        <section className="flex flex-col gap-3">
            {meta ? <p className="text-sm text-base-content/60">{meta}</p> : null}
            {children}
        </section>
    );
}
