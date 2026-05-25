import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
    variants: {
        variant: {
            default: "border-transparent bg-primary text-primary-foreground",
            secondary: "border-transparent bg-secondary text-secondary-foreground",
            outline: "border-border text-foreground",
            warning: "border-warning/20 bg-warning/10 text-warning-foreground",
            success: "border-success/20 bg-success/10 text-success-foreground",
            destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return <span className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />;
}

export { badgeVariants };
