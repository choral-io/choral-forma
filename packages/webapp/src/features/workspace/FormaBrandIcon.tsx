import { useId } from "react";

import { brandIconPaths, brandIconViewBox } from "@/lib/brand-icon";

export function FormaBrandIcon({ className }: { className?: string }) {
    const id = useId().replaceAll(":", "");
    const tileGradientId = `${id}-forma-tile`;
    const barsGradientId = `${id}-forma-bars`;

    return (
        <svg aria-hidden="true" className={className} focusable="false" viewBox={brandIconViewBox}>
            <defs>
                <linearGradient id={tileGradientId} x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--workspace-brand-tile-start)" />
                    <stop offset="1" stopColor="var(--workspace-brand-tile-end)" />
                </linearGradient>
                <linearGradient id={barsGradientId} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="var(--workspace-brand-bars-start)" />
                    <stop offset="1" stopColor="var(--workspace-brand-bars-end)" />
                </linearGradient>
            </defs>
            <rect fill={`url(#${tileGradientId})`} height="450" rx="80" width="454" />
            {brandIconPaths.map((path) => (
                <path d={path} fill={`url(#${barsGradientId})`} key={path} />
            ))}
        </svg>
    );
}
