import { GitFork } from "lucide-react";
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
				className="flex items-center gap-3 px-6 py-4 border-b shrink-0"
				style={{ borderColor: "var(--border-subtle)" }}
			>
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center"
					style={{ background: "var(--color-teal-border)" }}
				>
					<GitFork className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
				</div>
				<div>
					<h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
						Servis Bağımlılık Haritası
					</h1>
					<p className="text-xs hidden sm:block" style={{ color: "var(--text-faint)" }}>
						Servisleri sürükle, bağlantı kurmak için bir node'dan diğerine çiz. Haritayı kaydetmek için Kaydet'e bas.
					</p>
				</div>
			</div>

			<div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
				<ServiceMap />
			</div>
		</div>
	);
}
