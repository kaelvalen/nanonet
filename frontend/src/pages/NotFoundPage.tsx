import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router";
import { DotMatrix } from "@/components/DotMatrix";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
	const navigate = useNavigate();

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
				<p
					className="text-[10px] font-mono uppercase tracking-wider mb-3"
					style={{ color: "var(--text-faint)" }}
				>
					Error 404
				</p>
				<h1
					className="text-[64px] leading-none font-semibold tnum mb-4"
					style={{ color: "var(--text-primary)" }}
				>
					404
				</h1>
				<h2
					className="text-[16px] font-semibold mb-2"
					style={{ color: "var(--text-primary)" }}
				>
					Sayfa bulunamadı
				</h2>
				<p
					className="text-[13px] leading-relaxed mb-8"
					style={{ color: "var(--text-tertiary)" }}
				>
					Aradığınız sayfa mevcut değil veya taşınmış olabilir.
				</p>

				<div className="flex gap-2 justify-center">
					<Button variant="outline" size="sm" onClick={() => navigate(-1)}>
						<ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
						Geri dön
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
