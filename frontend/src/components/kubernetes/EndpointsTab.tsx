import { HardDrive, Loader2, Network, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import type { ServiceInfo } from "@/api/k8s";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface EndpointsData {
	service: string;
	count: number;
	endpoints: string[];
}

export interface EndpointsTabProps {
	endpointName: string;
	setEndpointName: (name: string) => void;
	services: ServiceInfo[];
	endpointsLoading: boolean;
	endpointsData: EndpointsData | null | undefined;
	refetchEndpoints: () => void;
}

export function EndpointsTab({
	endpointName,
	setEndpointName,
	services,
	endpointsLoading,
	endpointsData,
	refetchEndpoints,
}: EndpointsTabProps) {
	return (
		<motion.div
			key="endpoints"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			className="space-y-4"
		>
			<Card
				className="p-4 rounded-xl"
				style={{
					background: "var(--surface-glass)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<div className="flex items-center gap-2">
					{services.length > 0 ? (
						<Select value={endpointName} onValueChange={setEndpointName}>
							<SelectTrigger
								className="rounded-lg text-xs h-9 flex-1"
								style={{
									background: "var(--input-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							>
								<SelectValue placeholder="Service seçin..." />
							</SelectTrigger>
							<SelectContent>
								{services.map((s) => (
									<SelectItem key={s.name} value={s.name}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Input
							placeholder="K8s Service adı (örn: my-service)"
							value={endpointName}
							onChange={(e) => setEndpointName(e.target.value)}
							className="rounded-lg text-xs h-9 flex-1"
							style={{
								background: "var(--input-bg)",
								borderColor: "var(--input-border)",
								color: "var(--text-secondary)",
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") refetchEndpoints();
							}}
						/>
					)}
					<Button
						onClick={() => refetchEndpoints()}
						disabled={!endpointName || endpointsLoading}
						size="sm"
						className="text-white rounded-lg h-9 px-3"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						{endpointsLoading ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<RefreshCw className="w-3.5 h-3.5" />
						)}
					</Button>
				</div>
			</Card>

			{endpointsData && (
				<Card
					className="p-5 rounded-xl"
					style={{
						background: "var(--surface-glass)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div className="flex items-center gap-2 mb-4">
						<Network
							className="w-4 h-4"
							style={{ color: "var(--status-warn)" }}
						/>
						<h3
							className="text-sm font-semibold"
							style={{ color: "var(--text-secondary)" }}
						>
							{endpointsData.service}
						</h3>
						<Badge
							className="text-[9px] px-2 py-0.5 rounded-full border ml-auto"
							style={{
								background:
									"color-mix(in srgb, var(--status-warn) 10%, transparent)",
								color: "var(--status-warn-text)",
								borderColor: "var(--status-warn-border)",
							}}
						>
							{endpointsData.count} endpoint
						</Badge>
					</div>
					{endpointsData.endpoints && endpointsData.endpoints.length > 0 ? (
						<div className="space-y-1.5">
							{endpointsData.endpoints.map((ep: string) => (
								<div
									key={ep}
									className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
									style={{ background: "var(--surface-sunken)" }}
								>
									<HardDrive
										className="w-3 h-3 shrink-0"
										style={{ color: "var(--status-up)" }}
									/>
									<span
										className="text-xs"
										style={{
											color: "var(--text-secondary)",
											fontFamily: "var(--font-mono)",
										}}
									>
										{ep}
									</span>
								</div>
							))}
						</div>
					) : (
						<p
							className="text-xs text-center py-4"
							style={{ color: "var(--text-faint)" }}
						>
							Aktif endpoint bulunamadı
						</p>
					)}
				</Card>
			)}
		</motion.div>
	);
}
