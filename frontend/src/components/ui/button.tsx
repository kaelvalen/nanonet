import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "./utils";

/* Six variants × four sizes. The MB rule: chrome buttons are quiet (ghost,
   outline) and the single accent (primary) is saved for the one decisive action
   per surface. Destructive owns its own hue for permanence; secondary is the
   neutral alternative. Link is text-only for inline navigation. */
const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px]",
		"text-[13px] font-medium leading-none",
		"transition-[background-color,color,border-color,box-shadow] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		"shrink-0 outline-none",
		"focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
		"aria-invalid:ring-2 aria-invalid:ring-[var(--status-down-border)] aria-invalid:border-[var(--status-down)]",
	].join(" "),
	{
		variants: {
			variant: {
				default:
					"bg-[var(--brand-primary)] text-[var(--brand-on-primary)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-pressed)]",
				destructive:
					"bg-[var(--status-down)] text-white hover:bg-[var(--status-down-text)]",
				outline: [
					"border border-[var(--border-default)]",
					"bg-transparent text-[var(--text-primary)]",
					"hover:bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]",
				].join(" "),
				secondary:
					"bg-[var(--surface-sunken)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]",
				ghost:
					"bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
				link: "bg-transparent text-[var(--text-link)] underline-offset-4 hover:underline hover:text-[var(--text-link-hover)]",
			},
			size: {
				default: "h-9 px-4 has-[>svg]:px-3",
				sm: "h-8 px-3 text-[12px] has-[>svg]:px-2.5 gap-1.5",
				lg: "h-10 px-6 text-[14px] has-[>svg]:px-5",
				icon: "size-9 p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const Button = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<"button"> &
		VariantProps<typeof buttonVariants> & {
			asChild?: boolean;
		}
>(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			ref={ref}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
});

Button.displayName = "Button";

export { Button, buttonVariants };
