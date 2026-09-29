import { Component, createElement, type MouseEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { TemporalHostProvider, type SourceLinkProps, type TemporalProjection, type TemporalViewState } from "./host";
import { ViewCalendarProjection } from "./ViewCalendarProjection";
import { ViewGanttProjection } from "./ViewGanttProjection";

class TemporalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    override state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    override render() {
        return this.state.failed ? null : this.props.children;
    }
}

/** Imperative adapter for a browser host with no React or router integration. */
export function mountTemporalView(options: {
    container: HTMLElement;
    projection: TemporalProjection;
    state: TemporalViewState;
    locale: string;
    onNavigate: (href: string, event: MouseEvent<HTMLAnchorElement>) => void;
    onReady: () => void;
    onError: (error: unknown) => void;
}) {
    const root = createRoot(options.container, { onCaughtError: options.onError, onUncaughtError: options.onError });
    function Link({ to, onClick, ...props }: SourceLinkProps) {
        return createElement("a", {
            ...props,
            href: to,
            onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    event.preventDefault();
                    options.onNavigate(to, event);
                }
            },
        });
    }
    const host = {
        Link,
        state: options.state,
        locale: options.locale,
        onStateChange: (next: TemporalViewState) => {
            Object.assign(options.state, next);
        },
    };
    const render = (projection: TemporalProjection) => {
        root.render(
            createElement(
                TemporalErrorBoundary,
                null,
                createElement(
                    TemporalHostProvider,
                    { value: host },
                    projection.kind === "calendar"
                        ? createElement(ViewCalendarProjection, { projection })
                        : createElement(ViewGanttProjection, { projection }),
                ),
            ),
        );
    };
    render(options.projection);
    // The host keeps its complete fallback until React has committed a view.
    const observer = new MutationObserver(() => {
        if (options.container.querySelector("section")) {
            observer.disconnect();
            options.onReady();
        }
    });
    observer.observe(options.container, { childList: true });
    return {
        update: render,
        destroy() {
            observer.disconnect();
            root.unmount();
        },
    };
}
