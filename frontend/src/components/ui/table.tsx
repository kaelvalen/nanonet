import type * as React from "react";

import { cn } from "./utils";

/* Table — dense data grid. The container handles horizontal overflow so the
   parent layout doesn't have to. Rows draw a 1px hairline (instead of zebra
   striping); the header is sticky-friendly via top-0 + bg-canvas. Numeric
   cells should add `tnum` for tabular alignment. */

function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto"
		>
			<table
				data-slot="table"
				className={cn(
					"w-full caption-bottom text-[13px] border-separate border-spacing-0",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn(
				"[&_tr]:border-0 [&_th]:bg-[var(--surface-canvas)]",
				className,
			)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child_td]:border-b-0", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"font-medium bg-[var(--surface-sunken)]",
				"[&>tr>td]:border-t [&>tr>td]:border-[var(--border-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				"transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
				"hover:bg-[var(--surface-sunken)]",
				"data-[state=selected]:bg-[var(--brand-primary-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-9 px-3 text-left align-middle whitespace-nowrap",
				"text-[11px] font-semibold uppercase tracking-wider",
				"text-[var(--text-tertiary)]",
				"border-b border-[var(--border-subtle)]",
				"[&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"px-3 py-2.5 align-middle whitespace-nowrap",
				"border-b border-[var(--border-subtle)]",
				"text-[var(--text-primary)]",
				"[&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
				className,
			)}
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("mt-4 text-[12px] text-[var(--text-tertiary)]", className)}
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
