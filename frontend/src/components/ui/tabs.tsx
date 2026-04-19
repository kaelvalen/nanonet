import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "./utils";

/* Tabs — underline style by default (MB-quiet, no pill background).
   The list is a flat row with a 1px hairline at the bottom; the active
   trigger draws a 2px brand underline. This works well at the top of a
   Card or page section without competing with surrounding chrome. */

function Tabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn("flex flex-col gap-3", className)}
			{...props}
		/>
	);
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"inline-flex h-10 w-full items-end justify-start gap-1",
				"border-b border-[var(--border-subtle)]",
				"text-[var(--text-tertiary)]",
				className,
			)}
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"relative inline-flex h-10 items-center justify-center gap-1.5 px-3",
				"text-[13px] font-medium leading-none whitespace-nowrap",
				"text-[var(--text-tertiary)]",
				"transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
				"hover:text-[var(--text-primary)]",
				"data-[state=active]:text-[var(--text-primary)]",
				"data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[var(--brand-primary)]",
				"focus-visible:outline-none focus-visible:text-[var(--text-primary)] focus-visible:after:absolute focus-visible:after:inset-1 focus-visible:after:rounded-[4px] focus-visible:after:ring-2 focus-visible:after:ring-[var(--border-focus)]",
				"disabled:pointer-events-none disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
