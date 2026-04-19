import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

import { cn } from "./utils";

/* Tooltip — single line of microcopy on hover/focus. We use the inverse
   surface so the tooltip reads as a different layer from the page chrome
   (the previous design used brand-primary which competed for attention with
   real CTAs). 240ms default delay; long-press equivalent on touch is handled
   by Radix. */

function TooltipProvider({
	delayDuration = 240,
	skipDelayDuration = 200,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			skipDelayDuration={skipDelayDuration}
			{...props}
		/>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return (
		<TooltipProvider>
			<TooltipPrimitive.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	sideOffset = 6,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				className={cn(
					"z-50 w-fit max-w-[280px] origin-(--radix-tooltip-content-transform-origin)",
					"rounded-[6px] px-2.5 py-1.5",
					"bg-[var(--surface-inverse)] text-[var(--text-inverse)]",
					"text-[12px] leading-snug font-medium text-balance",
					"shadow-[var(--shadow-md)]",
					"animate-in fade-in-0 zoom-in-95",
					"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
					"data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1",
					"data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
					className,
				)}
				{...props}
			>
				{children}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
