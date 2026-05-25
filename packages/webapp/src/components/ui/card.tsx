import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
    return (
        <section
            className={cn("border-border bg-card text-card-foreground rounded-lg border shadow-sm", className)}
            data-slot="card"
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("flex flex-col gap-1.5 p-5", className)} data-slot="card-header" {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
    return (
        <h3
            className={cn("text-base leading-none font-semibold tracking-normal", className)}
            data-slot="card-title"
            {...props}
        />
    );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
    return <p className={cn("text-muted-foreground text-sm", className)} data-slot="card-description" {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("p-5 pt-0", className)} data-slot="card-content" {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("flex items-center p-5 pt-0", className)} data-slot="card-footer" {...props} />;
}
