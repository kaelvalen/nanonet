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
			className="w-full h-10 mt-2"
		>
			{loading ? (
				<span className="flex items-center gap-2">
					<span
						className="w-3.5 h-3.5 rounded-full animate-spin"
						style={{
							border: "2px solid rgba(255,255,255,0.3)",
							borderTopColor: "var(--brand-on-primary)",
						}}
					/>
					{loadingLabel}
				</span>
			) : (
				children
			)}
		</Button>
	);
}
