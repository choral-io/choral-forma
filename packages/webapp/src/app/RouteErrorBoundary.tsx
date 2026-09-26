import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { useRouteContentFocusTarget } from "@/lib/route-focus";

export function RouteErrorBoundary() {
    const error = useRouteError();
    const message = describeRouteError(error);
    const headingRef = useRouteContentFocusTarget<HTMLHeadingElement>();

    return (
        <main className="flex min-h-screen items-center justify-center bg-base-100 p-6 text-base-content">
            <section className="card w-full max-w-md border border-base-300 bg-base-100">
                <div className="card-body">
                    <h1 className="card-title" ref={headingRef} tabIndex={-1}>
                        This page could not be displayed
                    </h1>
                    <p className="text-sm text-base-content/60">{message}</p>
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
