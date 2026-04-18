import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AuthSubmitButtonProps {
	loading: boolean;
	loadingLabel: string;
	disabled?: boolean;
	children: ReactNode;
}

export function AuthSubmitButton({
	loading,
	loadingLabel,
	disabled,
	children,
}: AuthSubmitButtonProps) {
	return (
		<Button
			type="submit"
			disabled={loading || disabled}
			className="w-full h-11 rounded-lg text-white text-sm font-black tracking-wide transition-all duration-200 active:scale-[0.99] disabled:opacity-40 mt-2"
			style={{
				background: "var(--gradient-btn-primary)",
				boxShadow: "var(--btn-shadow)",
			}}
		>
			{loading ? (
				<span className="flex items-center gap-2.5">
					<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
					{loadingLabel}
				</span>
			) : (
				children
			)}
		</Button>
	);
}
