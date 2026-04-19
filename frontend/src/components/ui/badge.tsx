import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "./utils";

/* Badge — semantic label, single-line. Variants align with button hierarchy:
   `default` is brand, `secondary` is neutral chrome, `destructive` is status,
   `outline` is the lowest weight (border only). For status-specific pills
   (up/down/degraded) use StatusBadge from ./status-atoms instead. */
const badgeVariants = cva(
	[
		"inline-flex items-center justify-center gap-1 w-fit shrink-0 whitespace-nowrap overflow-hidden",
		"rounded-[4px] border px-2 py-0.5",
		"text-[11px] font-medium leading-none",
		"font-variant-numeric: tabular-nums",
		"[&>svg]:size-3 [&>svg]:pointer-events-none",
		"transition-[color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
		"focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] focus-visible:outline-offset-2",
		"aria-invalid:border-[var(--status-down)]",
	].join(" "),
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-[var(--brand-primary)] text-[var(--brand-on-primary)] [a&]:hover:bg-[var(--brand-primary-hover)]",
				secondary:
					"border-transparent bg-[var(--surface-sunken)] text-[var(--text-secondary)] [a&]:hover:bg-[var(--border-subtle)]",
				destructive:
					"border-transparent bg-[var(--status-down)] text-white [a&]:hover:bg-[var(--status-down-text)]",
				outline:
					"border-[var(--border-default)] text-[var(--text-secondary)] [a&]:hover:bg-[var(--surface-sunken)]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant,
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "span";
	return (
		<Comp
			data-slot="badge"
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
