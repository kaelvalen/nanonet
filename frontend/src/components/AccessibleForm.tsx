import React from "react";

interface AccessibleFormProps {
	children: React.ReactNode;
	onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
	className?: string;
	ariaLabel?: string;
}

/**
 * Accessible Form Wrapper
 *
 * Features:
 * - Semantic <form> element
 * - aria-label for form identification
 * - Automatic focus on first error field
 * - Keyboard navigation support
 */
export function AccessibleForm({
	children,
	onSubmit,
	className = "",
	ariaLabel,
}: AccessibleFormProps) {
	const formRef = React.useRef<HTMLFormElement>(null);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Check for validation errors
		const invalidElements = formRef.current?.querySelectorAll(
			'[aria-invalid="true"]',
		);

		if (invalidElements && invalidElements.length > 0) {
			// Focus on first invalid element
			const firstInvalid = invalidElements[0] as HTMLElement;
			firstInvalid.focus();

			// Announce error to screen readers
			const errorMessage = firstInvalid.getAttribute("aria-describedby");
			if (errorMessage) {
				const errorElement = document.getElementById(errorMessage);
				if (errorElement) {
					errorElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
				}
			}

			return;
		}

		if (onSubmit) {
			onSubmit(e);
		}
	};

	return (
		<form
			ref={formRef}
			onSubmit={handleSubmit}
			className={className}
			aria-label={ariaLabel}
			noValidate
		>
			{children}
		</form>
	);
}

/**
 * Form Group for organizing related fields
 */
interface FormGroupProps {
	children: React.ReactNode;
	legend?: string;
	className?: string;
}

export function FormGroup({
	children,
	legend,
	className = "",
}: FormGroupProps) {
	if (legend) {
		return (
			<fieldset className={className}>
				<legend className="text-lg font-semibold mb-4">{legend}</legend>
				<div className="space-y-4">{children}</div>
			</fieldset>
		);
	}

	return <div className={`space-y-4 ${className}`}>{children}</div>;
}
