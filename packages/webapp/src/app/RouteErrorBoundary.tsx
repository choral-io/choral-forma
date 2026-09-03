import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { useRouteContentFocusTarget } from "@/lib/route-focus";

export function RouteErrorBoundary() {
    const error = useRouteError();
    const message = describeRouteError(error);
    const headingRef = useRouteContentFocusTarget<HTMLHeadingElement>();

    return (
        <main className="bg-base-100 text-base-content flex min-h-screen items-center justify-center p-6">
            <section className="card border-base-300 bg-base-100 w-full max-w-md border">
                <div className="card-body">
                    <h1 className="card-title" ref={headingRef} tabIndex={-1}>
                        This page could not be displayed
                    </h1>
                    <p className="text-base-content/60 text-sm">{message}</p>
                    <Link className="btn mt-2 self-start" to="/">
                        Back to workspace
                    </Link>
                </div>
            </section>
        </main>
    );
}

function describeRouteError(error: unknown) {
    if (isRouteErrorResponse(error)) {
        return `${String(error.status)} ${error.statusText || "Route error"}`;
    }

    return error instanceof Error ? error.message : "An unexpected rendering error occurred.";
}
