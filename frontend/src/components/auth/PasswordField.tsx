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
		? "var(--status-down-border)"
		: success
			? "var(--status-up-border)"
			: undefined;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<Label
					htmlFor={id}
					className="text-[11px] font-black uppercase tracking-[0.15em]"
					style={{ color: "var(--text-faint)" }}
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
					className={`h-11 rounded-lg text-sm font-medium pr-11 ${className ?? ""}`}
					style={borderColor ? { borderColor } : undefined}
				/>
				<button
					type="button"
					onClick={() => setShow((v) => !v)}
					className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
					style={{ color: "var(--text-faint)" }}
					tabIndex={-1}
					aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
				>
					{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
				</button>
			</div>
			{error && (
				<p
					className="text-[10px] font-medium mt-0.5"
					style={{ color: "var(--status-down-text)" }}
				>
					{error}
				</p>
			)}
		</div>
	);
}
