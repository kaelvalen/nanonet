import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
	label: string;
	id: string;
	type?: string;
	placeholder?: string;
	value?: string;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	error?: string;
	helperText?: string;
	required?: boolean;
	disabled?: boolean;
	autoComplete?: string;
	aria?: {
		label?: string;
		describedBy?: string;
	};
}

/**
 * Accessible Form Field Component
 *
 * Features:
 * - Proper label association with htmlFor
 * - aria-describedby linking errors and helper text
 * - aria-invalid for validation states
 * - aria-required for required fields
 * - Visible error messages with semantic markup
 */
export function FormField({
	label,
	id,
	type = "text",
	placeholder,
	value,
	onChange,
	error,
	helperText,
	required,
	disabled,
	autoComplete,
	aria,
}: FormFieldProps) {
	const errorId = error ? `${id}-error` : undefined;
	const helperId = helperText ? `${id}-helper` : undefined;
	const describedBy =
		[aria?.describedBy, errorId, helperId].filter(Boolean).join(" ") ||
		undefined;

	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-sm font-medium">
				{label}
				{required && (
					<span className="text-red-500 ml-1" aria-label="required">
						*
					</span>
				)}
			</Label>
			<Input
				id={id}
				type={type}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				disabled={disabled}
				autoComplete={autoComplete}
				aria-invalid={!!error}
				aria-required={required}
				aria-describedby={describedBy}
				aria-label={aria?.label || label}
				className={error ? "border-red-500 focus:border-red-500" : ""}
			/>

			{/* Error message */}
			{error && (
				<p
					id={errorId}
					className="text-sm text-red-500 font-medium"
					role="alert"
				>
					{error}
				</p>
			)}

			{/* Helper text */}
			{helperText && !error && (
				<p id={helperId} className="text-sm text-gray-500">
					{helperText}
				</p>
			)}
		</div>
	);
}
