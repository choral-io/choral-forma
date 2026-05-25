import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function ScrollArea({ className, children, ...props }: ComponentProps<typeof BaseScrollArea.Root>) {
    return (
        <BaseScrollArea.Root className={cn("relative overflow-hidden", className)} data-slot="scroll-area" {...props}>
            <BaseScrollArea.Viewport className="size-full rounded-[inherit]">
                <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
            </BaseScrollArea.Viewport>
            <BaseScrollArea.Scrollbar
                className="flex touch-none p-0.5 select-none data-[orientation=horizontal]:h-2 data-[orientation=vertical]:w-2"
                orientation="vertical"
            >
                <BaseScrollArea.Thumb className="bg-border relative flex-1 rounded-full" />
            </BaseScrollArea.Scrollbar>
            <BaseScrollArea.Corner />
        </BaseScrollArea.Root>
    );
}
