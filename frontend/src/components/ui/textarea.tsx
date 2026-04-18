import type * as React from "react";

import { cn } from "./utils";

function Textarea({
	className,
	style,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"resize-none placeholder:text-muted-foreground hover:border-[var(--border-strong)] focus-visible:border-[var(--border-focus)] focus-visible:ring-[var(--border-focus)]/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
}

export { Textarea };
