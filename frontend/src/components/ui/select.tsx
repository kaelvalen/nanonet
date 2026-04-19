import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "./utils";

/* Native-feel select built on Radix. Trigger height matches Input (h-9 / h-8)
   so they can sit side-by-side in a form row without misalignment. The popover
   uses --surface-overlay + 1px border + lg shadow. */

function Select({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
	size?: "sm" | "default";
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				"flex w-full items-center justify-between gap-2 rounded-[6px] border px-3",
				"text-[13px] whitespace-nowrap",
				"bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]",
				"transition-[color,box-shadow,border-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
				"outline-none",
				"data-[placeholder]:text-[var(--text-placeholder)]",
				"hover:border-[var(--border-strong)]",
				"focus-visible:border-[var(--border-focus)] focus-visible:shadow-[0_0_0_3px_var(--input-border-focus)]",
				"data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:text-[12px]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				"[&_svg:not([class*='text-'])]:text-[var(--text-tertiary)]",
				"*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
				"aria-invalid:border-[var(--status-down)] aria-invalid:shadow-[0_0_0_3px_var(--status-down-subtle)]",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<ChevronDownIcon className="size-4 opacity-60" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	position = "popper",
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				data-slot="select-content"
				className={cn(
					"relative z-50 min-w-32 max-h-(--radix-select-content-available-height) origin-(--radix-select-content-transform-origin)",
					"overflow-x-hidden overflow-y-auto rounded-[6px] border",
					"bg-[var(--surface-overlay)] border-[var(--border-subtle)] text-[var(--text-primary)]",
					"shadow-[var(--shadow-lg)]",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
					position === "popper" &&
						"data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
					className,
				)}
				position={position}
				{...props}
			>
				<SelectScrollUpButton />
				<SelectPrimitive.Viewport
					className={cn(
						"p-1",
						position === "popper" &&
							"h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectScrollDownButton />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
	return (
		<SelectPrimitive.Label
			data-slot="select-label"
			className={cn(
				"px-2 py-1.5 text-[11px] uppercase tracking-wider font-semibold",
				"text-[var(--text-tertiary)]",
				className,
			)}
			{...props}
		/>
	);
}

function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"relative flex w-full cursor-default items-center gap-2 rounded-[4px] py-1.5 pr-8 pl-2",
				"text-[13px] outline-hidden select-none",
				"text-[var(--text-primary)]",
				"focus:bg-[var(--surface-sunken)] focus:text-[var(--text-primary)]",
				"data-[disabled]:pointer-events-none data-disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				"[&_svg:not([class*='text-'])]:text-[var(--text-tertiary)]",
				"*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
				className,
			)}
			{...props}
		>
			<span className="absolute right-2 flex size-3.5 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-3.5 text-[var(--brand-primary)]" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn(
				"pointer-events-none -mx-1 my-1 h-px bg-[var(--border-subtle)]",
				className,
			)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
	return (
		<SelectPrimitive.ScrollUpButton
			data-slot="select-scroll-up-button"
			className={cn(
				"flex cursor-default items-center justify-center py-1 text-[var(--text-tertiary)]",
				className,
			)}
			{...props}
		>
			<ChevronUpIcon className="size-4" />
		</SelectPrimitive.ScrollUpButton>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
	return (
		<SelectPrimitive.ScrollDownButton
			data-slot="select-scroll-down-button"
			className={cn(
				"flex cursor-default items-center justify-center py-1 text-[var(--text-tertiary)]",
				className,
			)}
			{...props}
		>
			<ChevronDownIcon className="size-4" />
		</SelectPrimitive.ScrollDownButton>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
