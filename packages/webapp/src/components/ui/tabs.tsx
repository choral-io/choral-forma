import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: ComponentProps<typeof BaseTabs.Root>) {
    return <BaseTabs.Root className={cn("flex flex-col gap-3", className)} data-slot="tabs" {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof BaseTabs.List>) {
    return (
        <BaseTabs.List
            className={cn("bg-muted text-muted-foreground inline-flex h-9 items-center rounded-md p-1", className)}
            data-slot="tabs-list"
            {...props}
        />
    );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
    return (
        <BaseTabs.Tab
            className={cn(
                "hover:text-foreground data-selected:bg-background data-selected:text-foreground focus-visible:ring-ring inline-flex h-7 items-center justify-center rounded px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 data-selected:shadow-sm",
                className,
            )}
            data-slot="tabs-trigger"
            {...props}
        />
    );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof BaseTabs.Panel>) {
    return (
        <BaseTabs.Panel
            className={cn("focus-visible:ring-ring outline-none focus-visible:ring-2", className)}
            data-slot="tabs-content"
            {...props}
        />
    );
}
