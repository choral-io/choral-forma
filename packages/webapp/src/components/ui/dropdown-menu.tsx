import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = BaseMenu.Root;
export const DropdownMenuTrigger = BaseMenu.Trigger;
export const DropdownMenuPortal = BaseMenu.Portal;
export const DropdownMenuGroup = BaseMenu.Group;
export const DropdownMenuSeparator = BaseMenu.Separator;

export function DropdownMenuContent({
    className,
    sideOffset = 8,
    ...props
}: ComponentProps<typeof BaseMenu.Popup> & { sideOffset?: number }) {
    return (
        <BaseMenu.Portal>
            <BaseMenu.Positioner sideOffset={sideOffset}>
                <BaseMenu.Popup
                    className={cn(
                        "border-border bg-popover text-popover-foreground z-50 min-w-44 overflow-hidden rounded-lg border p-1 shadow-lg outline-none",
                        className,
                    )}
                    data-slot="dropdown-menu-content"
                    {...props}
                />
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof BaseMenu.Item>) {
    return (
        <BaseMenu.Item
            className={cn(
                "hover:bg-muted focus:bg-muted relative flex cursor-default items-center rounded-md px-2 py-1.5 text-sm transition-colors outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            data-slot="dropdown-menu-item"
            {...props}
        />
    );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof BaseMenu.GroupLabel>) {
    return (
        <BaseMenu.GroupLabel
            className={cn("text-muted-foreground px-2 py-1.5 text-xs font-medium", className)}
            data-slot="dropdown-menu-label"
            {...props}
        />
    );
}
