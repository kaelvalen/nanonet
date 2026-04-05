import { Brain, GitFork } from "lucide-react";
import { ServiceMap } from "@/components/ServiceMap";

export function ServiceMapPage() {
	return (
		<div
			className="flex flex-col"
			style={{ margin: "-4rem -1.5rem -2rem", height: "calc(100vh - 20px)" }}
		>
			{/* Header */}
			<div
				className="flex items-center gap-3 px-5 py-3 shrink-0"
				style={{ borderBottom: "1px solid var(--border-default)" }}
			>
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
					style={{
						background: "var(--color-teal-subtle)",
						border: "1px solid var(--color-teal-border)",
					}}
				>
					<GitFork className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
				</div>
				<div className="flex-1 min-w-0">
					<h1
						className="text-sm font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						Servis Bağımlılık Haritası
					</h1>
					<p
						className="text-xs hidden sm:block"
						style={{ color: "var(--text-faint)" }}
					>
						Sürükle · bağlantı için node'dan node'a çiz · tıkla detay ve AI
						analizi için
					</p>
				</div>
				<span
					className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
					style={{
						background: "var(--color-lavender-subtle)",
						border: "1px solid var(--color-lavender-border)",
						color: "var(--color-lavender)",
					}}
				>
					<Brain className="w-3.5 h-3.5" />
					AI Destekli
				</span>
			</div>

			{/* Map */}
			<div className="flex-1 min-h-0 overflow-hidden">
				<ServiceMap />
			</div>
		</div>
	);
}
