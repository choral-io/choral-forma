import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const TooltipProvider = BaseTooltip.Provider;
export const Tooltip = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;

export function TooltipContent({
    className,
    sideOffset = 8,
    ...props
}: ComponentProps<typeof BaseTooltip.Popup> & { sideOffset?: number }) {
    return (
        <BaseTooltip.Portal>
            <BaseTooltip.Positioner sideOffset={sideOffset}>
                <BaseTooltip.Popup
                    className={cn(
                        "bg-foreground text-background z-50 rounded-md px-2.5 py-1.5 text-xs shadow-md",
                        className,
                    )}
                    data-slot="tooltip-content"
                    {...props}
                />
            </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
    );
}
