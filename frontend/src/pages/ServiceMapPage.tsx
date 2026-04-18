import { ServiceMap } from "@/components/service-map/ServiceMap";
import { useRegisterPageMeta } from "@/components/PageMetaContext";

export function ServiceMapPage() {
	useRegisterPageMeta({
		eyebrow: "Topoloji",
		title: "Servis Haritası",
	});

	return (
		<div className="flex-1 min-h-0 flex flex-col">
			<ServiceMap />
		</div>
	);
}
