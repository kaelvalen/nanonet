import { Brain, GitFork } from "lucide-react";
import { ServiceMap } from "@/components/service-map/ServiceMap";
import { PanelIcon } from "@/components/ui/primitives";

export function ServiceMapPage() {
	return (
		<div
			className="flex flex-col h-full"
			style={{
				paddingLeft: "var(--dock-w, 5rem)",
				boxSizing: "border-box",
			}}
		>
			<div
				className="flex items-center gap-3 px-3 sm:px-5 py-2.5 sm:py-3 shrink-0 backdrop-blur-md"
				style={{
					background:
						"color-mix(in srgb, var(--background) 90%, transparent)",
					borderBottom: "1px solid var(--border-default)",
				}}
			>
				<PanelIcon tone="accent">
					<GitFork className="w-4 h-4" />
				</PanelIcon>
				<div className="flex-1 min-w-0">
					<h1
						className="text-sm font-semibold leading-tight"
						style={{ color: "var(--text-primary)" }}
					>
						Servis Bağımlılık Haritası
					</h1>
					<p
						className="text-[11px] hidden sm:block leading-snug"
						style={{ color: "var(--text-faint)" }}
					>
						Sürükle · bağlantı için node'dan node'a çiz · tıkla detay ve AI
						analizi için
					</p>
				</div>
				<span
					className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shrink-0"
					style={{
						background: "var(--color-violet-subtle)",
						border: "1px solid var(--color-violet-border)",
						color: "var(--color-violet)",
					}}
				>
					<Brain className="w-3.5 h-3.5" />
					AI Destekli
				</span>
			</div>

			<div className="flex-1 min-h-0 overflow-hidden">
				<ServiceMap />
			</div>
		</div>
	);
}
