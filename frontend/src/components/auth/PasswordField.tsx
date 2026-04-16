import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	autoComplete?: string;
	disabled?: boolean;
	required?: boolean;
	rightSlot?: React.ReactNode;
	error?: string | null;
	success?: boolean;
	className?: string;
}

/**
 * Password input with show/hide toggle. Used across all auth pages for
 * consistent interaction.
 */
export function PasswordField({
	id,
	label,
	value,
	onChange,
	placeholder = "••••••••••••",
	autoComplete = "current-password",
	disabled = false,
	required = true,
	rightSlot,
	error,
	success,
	className,
}: PasswordFieldProps) {
	const [show, setShow] = useState(false);

	const borderColor = error
		? "border-red-300 focus-visible:ring-red-400"
		: success
			? "border-emerald-300 focus-visible:ring-emerald-400"
			: "border-slate-200 focus-visible:ring-teal-500 focus-visible:border-teal-500";

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<Label
					htmlFor={id}
					className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
				>
					{label}
				</Label>
				{rightSlot}
			</div>
			<div className="relative">
				<Input
					id={id}
					type={show ? "text" : "password"}
					autoComplete={autoComplete}
					placeholder={placeholder}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					required={required}
					disabled={disabled}
					className={`h-11 rounded-lg bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 transition-colors pr-11 ${borderColor} ${className ?? ""}`}
				/>
				<button
					type="button"
					onClick={() => setShow((v) => !v)}
					className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
					tabIndex={-1}
					aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
				>
					{show ? (
						<EyeOff className="w-4 h-4" />
					) : (
						<Eye className="w-4 h-4" />
					)}
				</button>
			</div>
			{error && (
				<p className="text-[10px] text-red-500 font-medium mt-0.5">{error}</p>
			)}
		</div>
	);
}
