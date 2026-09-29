import type { CalendarProjection, GanttProjection } from "@choral-forma/shared";
import { createContext, createElement, use, type AnchorHTMLAttributes, type ComponentType } from "react";

export type CalendarViewProjection = CalendarProjection & { routes: Record<string, string> };
export type GanttViewProjection = GanttProjection & { routes: Record<string, string>; canonicalLanguage?: string };
export type TemporalProjection = CalendarViewProjection | GanttViewProjection;

/** Viewer state only. Never written into the Core projection or source document. */
export interface TemporalViewState {
    calendar?: { month: string; agenda: boolean };
    gantt?: {
        range: { start: number; end: number };
        width: number;
        activePath: string | undefined;
        left: number;
        top: number;
        listOpen: boolean;
    };
}
export type SourceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };
export interface TemporalHost {
    Link?: ComponentType<SourceLinkProps>;
    navigationKey?: string;
    locale?: string;
    state?: TemporalViewState;
    onStateChange?: (state: TemporalViewState) => void;
}
const HostContext = createContext<TemporalHost>({});
export const TemporalHostProvider = HostContext.Provider;
export function useTemporalHost(): TemporalHost {
    return use(HostContext);
}
export function SourceLink({ to, ...props }: SourceLinkProps) {
    const { Link } = useTemporalHost();
    return Link ? createElement(Link, { to, ...props }) : <a href={to} {...props} />;
}
