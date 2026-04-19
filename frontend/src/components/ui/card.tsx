import type * as React from "react";

import { cn } from "./utils";

/* Card grammar — every section that has its own identity goes in a Card.
   1px hairline + sm shadow only when the card is genuinely floating; the
   default look is flat-with-border so multiple cards on a page don't pile
   visual weight. Padding is 16px on all sides; the structural sub-components
   (Header, Content, Footer) wire that automatically. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				"flex flex-col gap-4 rounded-[6px] border",
				"bg-[var(--surface-base)] text-[var(--text-primary)]",
				"border-[var(--border-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header grid auto-rows-min grid-rows-[auto_auto]",
				"items-start gap-1 px-4 pt-4",
				"has-data-[slot=card-action]:grid-cols-[1fr_auto]",
				"[.border-b]:pb-4 [.border-b]:border-[var(--border-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<h3
			data-slot="card-title"
			className={cn(
				"text-[14px] font-semibold leading-tight tracking-tight",
				"text-[var(--text-primary)]",
				className,
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<p
			data-slot="card-description"
			className={cn(
				"text-[12px] leading-snug text-[var(--text-tertiary)]",
				className,
			)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-4 [&:last-child]:pb-4", className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				"flex items-center gap-2 px-4 pb-4",
				"[.border-t]:pt-4 [.border-t]:border-[var(--border-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};
