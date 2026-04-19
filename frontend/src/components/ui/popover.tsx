import * as PopoverPrimitive from "@radix-ui/react-popover";
import type * as React from "react";

import { cn } from "./utils";

/* Popover — flyout for menus, filters, secondary content. Larger than tooltip,
   focusable, dismissed by click-outside or Escape. Uses --surface-overlay so
   it sits cleanly above any underlying card. */

function Popover({
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
	className,
	align = "center",
	sideOffset = 6,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-50 w-72 origin-(--radix-popover-content-transform-origin)",
					"rounded-[6px] border p-3 outline-hidden",
					"bg-[var(--surface-overlay)] text-[var(--text-primary)]",
					"border-[var(--border-subtle)]",
					"shadow-[var(--shadow-md)]",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
					"data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
}

function PopoverAnchor({
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
