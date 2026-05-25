import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogPortal = BaseDialog.Portal;
export const DialogClose = BaseDialog.Close;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;

export function DialogBackdrop({ className, ...props }: ComponentProps<typeof BaseDialog.Backdrop>) {
    return (
        <BaseDialog.Backdrop
            className={cn("bg-foreground/20 fixed inset-0 z-40 backdrop-blur-sm", className)}
            data-slot="dialog-backdrop"
            {...props}
        />
    );
}

export function DialogContent({ className, children, ...props }: ComponentProps<typeof BaseDialog.Popup>) {
    return (
        <DialogPortal>
            <DialogBackdrop />
            <BaseDialog.Popup
                className={cn(
                    "border-border bg-card text-card-foreground fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-xl outline-none",
                    className,
                )}
                data-slot="dialog-content"
                {...props}
            >
                {children}
                <BaseDialog.Close className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 transition-colors outline-none focus-visible:ring-2">
                    <X data-icon="inline-start" />
                    <span className="sr-only">Close</span>
                </BaseDialog.Close>
            </BaseDialog.Popup>
        </DialogPortal>
    );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("flex flex-col gap-2 text-left", className)} data-slot="dialog-header" {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
            data-slot="dialog-footer"
            {...props}
        />
    );
}
