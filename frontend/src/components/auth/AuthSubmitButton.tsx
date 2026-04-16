import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AuthSubmitButtonProps {
	loading: boolean;
	loadingLabel: string;
	disabled?: boolean;
	children: ReactNode;
}

/**
 * Shared submit button for auth forms — consistent teal CTA with spinner.
 */
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
			className="w-full h-11 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-black tracking-wide transition-all duration-200 active:scale-[0.99] disabled:opacity-40 mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
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
