import * as React from "react";

import { cn } from "./utils";

/* Single-line text input. 1px hairline border, no inner shadow, semantic tokens.
   The shadcn defaults set transparent borders that disappear on light surfaces;
   we anchor to --input-bg / --input-border so callers don't have to repeat this
   on every form field. */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, style, ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				data-slot="input"
				className={cn(
					"flex h-9 w-full min-w-0 rounded-[6px] border px-3 py-1",
					"text-[13px] leading-none",
					"transition-[color,box-shadow,border-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
					"outline-none",
					"placeholder:text-[var(--text-placeholder)]",
					"selection:bg-[var(--brand-primary-muted)]",
					"hover:border-[var(--border-strong)]",
					"focus-visible:border-[var(--border-focus)] focus-visible:shadow-[0_0_0_3px_var(--input-border-focus)]",
					"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
					"file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[12px] file:font-medium file:text-[var(--text-primary)]",
					"aria-invalid:border-[var(--status-down)] aria-invalid:shadow-[0_0_0_3px_var(--status-down-subtle)]",
					className,
				)}
				style={{
					background: "var(--input-bg)",
					borderColor: "var(--input-border)",
					color: "var(--text-primary)",
					...style,
				}}
				{...props}
			/>
		);
	},
);

Input.displayName = "Input";

export { Input };
