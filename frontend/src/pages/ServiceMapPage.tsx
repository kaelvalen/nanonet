import { GitFork } from "lucide-react";
import { ServiceMap } from "@/components/ServiceMap";

export function ServiceMapPage() {
	return (
		<div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
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
					<p className="text-xs" style={{ color: "var(--text-faint)" }}>
						Servisleri sürükle, bağlantı kurmak için bir node'dan diğerine çiz. Haritayı kaydetmek için Kaydet'e bas.
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-hidden">
				<ServiceMap />
			</div>
		</div>
	);
}
