import { Brain, GitFork } from "lucide-react";
import { ServiceMap } from "@/components/ServiceMap";
import { useNavStore } from "@/store/navStore";

export function ServiceMapPage() {
	const { navMode } = useNavStore();
	const isSidebar = navMode === "sidebar";

	return (
		<div
			className="flex flex-col"
			style={{
				margin: "-0.75rem -0.75rem -2rem",
				height: isSidebar ? "calc(100vh - 56px)" : "calc(100vh - 72px)",
			}}
		>
			<div
				className="flex items-center gap-3 px-6 py-3.5 shrink-0"
				style={{ borderBottom: "2px solid var(--border-default)" }}
			>
				<div
					className="w-8 h-8 rounded flex items-center justify-center shrink-0"
					style={{
						background: "var(--color-teal-subtle)",
						border: "2px solid var(--color-teal-border)",
					}}
				>
					<GitFork className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
				</div>
				<div className="flex-1 min-w-0">
					<h1 className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
						Servis Bağımlılık Haritası
					</h1>
					<p className="text-[10px] hidden sm:block" style={{ color: "var(--text-faint)" }}>
						Servisleri sürükle · bağlantı için bir node'dan diğerine çiz · node'a tıkla detay ve AI analizi için
					</p>
				</div>
				<span
					className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium"
					style={{
						background: "var(--color-lavender-subtle)",
						border: "2px solid var(--color-lavender-border)",
						color: "var(--color-lavender)",
					}}
				>
					<Brain className="w-3 h-3" />
					AI Destekli
				</span>
			</div>

			<div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
				<ServiceMap />
			</div>
		</div>
	);
}
