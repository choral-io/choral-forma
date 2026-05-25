import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
                ghost: "hover:bg-muted hover:text-foreground",
                subtle: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            },
            size: {
                default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
                sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                icon: "size-8",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export function Button({
    className,
    size = "default",
    variant = "default",
    ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    return (
        <ButtonPrimitive className={cn(buttonVariants({ variant, size, className }))} data-slot="button" {...props} />
    );
}

export { buttonVariants };
