import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { DotMatrix } from "@/components/DotMatrix";
import { Button } from "@/components/ui/button";

export function ErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();

	let title = "Beklenmeyen hata";
	let message = "Bir şeyler yanlış gitti. Lütfen tekrar deneyin.";
	let code = "500";

	if (isRouteErrorResponse(error)) {
		title = error.statusText || title;
		message = error.data?.message ?? message;
		code = String(error.status);
	} else if (error instanceof Error) {
		message = error.message;
	}

	return (
		<div
			className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
			style={{ background: "var(--surface-canvas)" }}
		>
			<div className="absolute inset-0 pointer-events-none opacity-[0.35]">
				<DotMatrix />
			</div>

			<div
				className="relative z-10 w-full max-w-md text-center"
				style={{
					background: "var(--surface-base)",
					border: "1px solid var(--border-subtle)",
					borderRadius: "8px",
					padding: "40px 32px",
				}}
			>
				<div className="flex justify-center mb-6">
					<div
						className="w-12 h-12 rounded-[6px] flex items-center justify-center relative"
						style={{
							background: "var(--status-down-subtle)",
						}}
					>
						<span
							aria-hidden
							className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
							style={{ background: "var(--status-down)" }}
						/>
						<AlertTriangle
							className="w-6 h-6"
							style={{ color: "var(--status-down)" }}
						/>
					</div>
				</div>

				<p
					className="text-[10px] font-mono uppercase tracking-wider mb-2"
					style={{ color: "var(--text-faint)" }}
				>
					Error {code}
				</p>
				<h1
					className="text-[18px] font-semibold mb-2"
					style={{ color: "var(--text-primary)" }}
				>
					{title}
				</h1>
				<p
					className="text-[13px] leading-relaxed mb-8 break-words"
					style={{ color: "var(--text-tertiary)" }}
				>
					{message}
				</p>

				<div className="flex gap-2 justify-center">
					<Button
						variant="outline"
						size="sm"
						onClick={() => window.location.reload()}
					>
						<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
						Yenile
					</Button>
					<Button size="sm" onClick={() => navigate("/", { replace: true })}>
						<Home className="w-3.5 h-3.5 mr-1.5" />
						Ana sayfa
					</Button>
				</div>
			</div>
		</div>
	);
}
