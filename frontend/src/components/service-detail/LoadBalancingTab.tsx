import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Layers,
	Loader2,
	Minus,
	Plus,
	RefreshCw,
	Terminal,
	TrendingUp,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { k8sApi } from "@/api/k8s";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface LoadBalancingTabProps {
	serviceId: string;
	serviceName: string;
	scaleInstances: number;
	setScaleInstances: (v: number) => void;
	scaleStrategy: "round_robin" | "least_conn" | "ip_hash";
	setScaleStrategy: (v: "round_robin" | "least_conn" | "ip_hash") => void;
	scaleLoading: boolean;
	handleScale: () => void;
}

export function LoadBalancingTab({
	serviceId,
	serviceName,
	scaleInstances,
	setScaleInstances,
	scaleStrategy,
	setScaleStrategy,
	scaleLoading,
	handleScale,
}: LoadBalancingTabProps) {
	const _queryClient = useQueryClient();
	const [k8sMode, setK8sMode] = React.useState<"k8s" | "agent">("k8s");
	const [k8sDeployName, setK8sDeployName] = React.useState(
		serviceName.toLowerCase().replace(/\s+/g, "-"),
	);
	const [k8sReplicas, setK8sReplicas] = React.useState(2);
	const [hpaMin, setHpaMin] = React.useState(1);
	const [hpaMax, setHpaMax] = React.useState(8);
	const [hpaCpu, setHpaCpu] = React.useState(70);

	// K8s status check
	const { data: k8sStatus } = useQuery({
		queryKey: ["k8s-status-lb"],
		queryFn: k8sApi.getStatus,
		retry: 1,
		staleTime: 60000,
	});

	// K8s deployment info
	const { data: deployment, refetch: refetchDep } = useQuery({
		queryKey: ["k8s-dep-lb", k8sDeployName],
		queryFn: () => k8sApi.getDeployment(k8sDeployName),
		enabled: k8sMode === "k8s" && !!k8sStatus?.available && !!k8sDeployName,
		retry: 1,
	});

	// K8s pods
	const { data: podsData } = useQuery({
		queryKey: ["k8s-pods-lb", k8sDeployName],
		queryFn: () => k8sApi.getPods(`app=${k8sDeployName}`),
		enabled: k8sMode === "k8s" && !!k8sStatus?.available && !!k8sDeployName,
		retry: 1,
		refetchInterval: 15000,
	});

	// K8s HPA
	const { data: hpaInfo, refetch: refetchHPA } = useQuery({
		queryKey: ["k8s-hpa-lb", k8sDeployName],
		queryFn: async () => {
			try {
				return await k8sApi.getHPA(`${k8sDeployName}-hpa`);
			} catch (err: any) {
				const status = err?.response?.status;
				if (status === 404) return null;
				throw err;
			}
		},
		enabled: k8sMode === "k8s" && !!k8sStatus?.available && !!k8sDeployName,
		retry: 0,
	});

	const k8sScaleMutation = useMutation({
		mutationFn: () => k8sApi.scaleDeployment(k8sDeployName, k8sReplicas),
		onSuccess: (r) => {
			toast.success(r.message);
			refetchDep();
		},
		onError: () => toast.error("K8s scale başarısız"),
	});

	const hpaMutation = useMutation({
		mutationFn: () =>
			k8sApi.createOrUpdateHPA(k8sDeployName, hpaMin, hpaMax, hpaCpu),
		onSuccess: () => {
			toast.success("HPA uygulandı");
			refetchHPA();
		},
		onError: () => toast.error("HPA oluşturulamadı"),
	});

	const deleteHPAMutation = useMutation({
		mutationFn: () => k8sApi.deleteHPA(k8sDeployName),
		onSuccess: () => {
			toast.success("HPA silindi");
			refetchHPA();
		},
		onError: () => toast.error("HPA silinemedi"),
	});

	const isK8sAvailable = k8sStatus?.available ?? false;
	const pods = podsData?.pods ?? [];

	return (
		<div className="space-y-4">
			{/* Mode Toggle */}
			<div className="flex items-center gap-2">
				<button
					onClick={() => setK8sMode("k8s")}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border-2 transition-all"
					style={
						k8sMode === "k8s"
							? {
									background: "var(--color-blue-subtle)",
									borderColor: "var(--color-blue-border)",
									color: "var(--color-blue)",
								}
							: { color: "var(--text-muted)", borderColor: "transparent" }
					}
				>
					<svg
						className="w-3.5 h-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
					</svg>
					Kubernetes
					{isK8sAvailable && (
						<span
							className="w-1.5 h-1.5 rounded-full ml-1"
							style={{ backgroundColor: "var(--status-up)" }}
						/>
					)}
					{!isK8sAvailable && (
						<span
							className="text-[9px] ml-1"
							style={{ color: "var(--text-faint)" }}
						>
							(devre dışı)
						</span>
					)}
				</button>
				<button
					onClick={() => setK8sMode("agent")}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border-2 transition-all"
					style={
						k8sMode === "agent"
							? {
									background: "var(--status-up-subtle)",
									borderColor: "var(--status-up-border)",
									color: "var(--status-up-text)",
								}
							: { color: "var(--text-muted)", borderColor: "transparent" }
					}
				>
					<Terminal className="w-3.5 h-3.5" />
					Agent Komutu
				</button>
			</div>

			{/* ──── K8s Mode ──── */}
			{k8sMode === "k8s" && (
				<div className="space-y-4">
					{!isK8sAvailable ? (
						<Card
							className="p-8 rounded text-center"
							style={{
								background: "var(--surface-card)",
								border: "2px solid var(--color-blue-border)",
								boxShadow: "var(--card-shadow)",
							}}
						>
							<Layers
								className="w-10 h-10 mx-auto mb-3 opacity-40"
								style={{ color: "var(--color-blue)" }}
							/>
							<h3
								className="text-sm font-semibold mb-1"
								style={{ color: "var(--text-secondary)" }}
							>
								Kubernetes Bağlantısız
							</h3>
							<p
								className="text-[10px] max-w-sm mx-auto"
								style={{ color: "var(--text-muted)" }}
							>
								Backend'de{" "}
								<code
									className="px-1 rounded"
									style={{ background: "var(--surface-sunken)" }}
								>
									K8S_NAMESPACE
								</code>{" "}
								tanımlayarak Kubernetes entegrasyonunu aktifleştirebilirsiniz.
							</p>
							<p
								className="text-[10px] mt-2"
								style={{ color: "var(--text-faint)" }}
							>
								Alternatif olarak "Agent Komutu" modunu kullanabilirsiniz.
							</p>
						</Card>
					) : (
						<>
							{/* Deployment name input */}
							<Card
								className="p-4 rounded"
								style={{
									background: "var(--surface-card)",
									border: "2px solid var(--color-blue-border)",
									boxShadow: "var(--card-shadow)",
								}}
							>
								<label
									className="text-[10px] uppercase tracking-wider block mb-2"
									style={{ color: "var(--text-muted)" }}
								>
									K8s Deployment Adı
								</label>
								<div className="flex items-center gap-2">
									<Input
										value={k8sDeployName}
										onChange={(e) => setK8sDeployName(e.target.value)}
										placeholder="deployment-name"
										className="rounded text-xs h-8 flex-1 font-mono"
										style={{
											background: "var(--input-bg)",
											borderColor: "var(--input-border)",
											color: "var(--text-secondary)",
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") refetchDep();
										}}
									/>
									<Button
										size="sm"
										onClick={() => refetchDep()}
										className="rounded h-8 text-xs"
										variant="outline"
										style={{
											borderColor: "var(--color-blue-border)",
											color: "var(--color-blue)",
											boxShadow: "var(--btn-shadow)",
										}}
									>
										<RefreshCw className="w-3 h-3" />
									</Button>
								</div>
							</Card>

							{/* Deployment Info */}
							{deployment && (
								<Card
									className="p-5 rounded"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--color-blue-border)",
										boxShadow: "var(--card-shadow)",
									}}
								>
									<div className="flex items-center gap-2 mb-4">
										<Layers
											className="w-4 h-4"
											style={{ color: "var(--color-blue)" }}
										/>
										<h3
											className="text-sm font-semibold"
											style={{ color: "var(--text-secondary)" }}
										>
											{deployment.name}
										</h3>
										<Badge
											className="text-[9px] px-1.5 py-0.5 rounded border-2 ml-auto"
											style={{
												background: "var(--color-blue-subtle)",
												color: "var(--color-blue)",
												borderColor: "var(--color-blue-border)",
											}}
										>
											{deployment.strategy}
										</Badge>
									</div>

									<div className="grid grid-cols-4 gap-2 mb-4">
										{[
											{
												label: "İstenen",
												value: deployment.replicas,
												color: "var(--color-blue)",
											},
											{
												label: "Hazır",
												value: deployment.ready_replicas,
												color: "var(--status-up)",
											},
											{
												label: "Kullanılabilir",
												value: deployment.available_replicas,
												color: "var(--color-teal)",
											},
											{
												label: "Güncellenen",
												value: deployment.updated_replicas,
												color: "var(--color-lavender)",
											},
										].map((s) => (
											<div
												key={s.label}
												className="p-2.5 rounded text-center"
												style={{
													background: "var(--surface-sunken)",
													border: "1.5px solid var(--border-default)",
												}}
											>
												<p
													className="text-[9px] uppercase tracking-wider mb-0.5"
													style={{ color: "var(--text-faint)" }}
												>
													{s.label}
												</p>
												<p
													className="text-lg font-bold"
													style={{ color: s.color }}
												>
													{s.value}
												</p>
											</div>
										))}
									</div>

									{/* K8s Scale */}
									<div
										className="p-3 rounded mb-3"
										style={{
											background: "var(--surface-sunken)",
											border: "2px solid var(--border-default)",
										}}
									>
										<label
											className="text-[10px] uppercase tracking-wider block mb-2"
											style={{ color: "var(--text-muted)" }}
										>
											Kubernetes Scale
										</label>
										<div className="flex items-center gap-3">
											<button
												onClick={() =>
													setK8sReplicas(Math.max(0, k8sReplicas - 1))
												}
												aria-label="Decrease Kubernetes replicas"
												className="w-7 h-7 rounded flex items-center justify-center"
												style={{
													border: "2px solid var(--color-blue-border)",
													color: "var(--color-blue)",
												}}
											>
												<Minus className="w-3 h-3" />
											</button>
											<span
												className="text-xl font-bold w-8 text-center"
												style={{ color: "var(--text-secondary)" }}
											>
												{k8sReplicas}
											</span>
											<button
												onClick={() =>
													setK8sReplicas(Math.min(32, k8sReplicas + 1))
												}
												aria-label="Increase Kubernetes replicas"
												className="w-7 h-7 rounded flex items-center justify-center"
												style={{
													border: "2px solid var(--color-blue-border)",
													color: "var(--color-blue)",
												}}
											>
												<Plus className="w-3 h-3" />
											</button>
											<div className="flex gap-1 ml-1">
												{[1, 2, 4, 8].map((n) => (
													<button
														key={n}
														onClick={() => setK8sReplicas(n)}
														className="px-2 py-1 rounded text-[10px] font-medium border-2 transition-all"
														style={
															k8sReplicas === n
																? {
																		background: "var(--color-blue-subtle)",
																		color: "var(--color-blue)",
																		borderColor: "var(--color-blue-border)",
																	}
																: {
																		color: "var(--text-muted)",
																		borderColor: "var(--border-subtle)",
																	}
														}
													>
														{n}x
													</button>
												))}
											</div>
											<Button
												size="sm"
												onClick={() => k8sScaleMutation.mutate()}
												disabled={k8sScaleMutation.isPending}
												className="ml-auto text-white rounded text-xs h-8 px-3"
												style={{ background: "var(--color-blue)" }}
											>
												{k8sScaleMutation.isPending ? (
													<Loader2 className="w-3 h-3 animate-spin" />
												) : (
													<>
														<Layers className="w-3 h-3 mr-1" /> Scale
													</>
												)}
											</Button>
										</div>
									</div>
								</Card>
							)}

							{/* Pod List */}
							{pods.length > 0 && (
								<Card
									className="p-4 rounded"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--color-teal-border)",
										boxShadow: "var(--card-shadow)",
									}}
								>
									<div className="flex items-center justify-between mb-3">
										<h4
											className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
											style={{ color: "var(--text-muted)" }}
										>
											<Activity
												className="w-3 h-3"
												style={{ color: "var(--color-teal)" }}
											/>{" "}
											Pod'lar
										</h4>
										<Badge
											className="text-[9px] px-1.5 py-0.5 rounded border-2"
											style={{
												background: "var(--color-teal-subtle)",
												color: "var(--color-teal)",
												borderColor: "var(--color-teal-border)",
											}}
										>
											{pods.filter((p: any) => p.ready).length}/{pods.length}{" "}
											hazır
										</Badge>
									</div>
									<div className="space-y-1.5">
										{pods.map((pod: any) => (
											<div
												key={pod.name}
												className="flex items-center gap-2 px-3 py-2 rounded"
												style={{
													background: "var(--surface-sunken)",
													border: "1.5px solid var(--border-default)",
												}}
											>
												<div
													className="w-2 h-2 rounded-full shrink-0"
													style={{
														backgroundColor: pod.ready
															? "var(--status-up)"
															: "var(--status-down)",
													}}
												/>
												<span
													className="text-[11px] font-mono truncate flex-1"
													style={{ color: "var(--text-secondary)" }}
												>
													{pod.name}
												</span>
												<span
													className="text-[9px]"
													style={{ color: "var(--text-faint)" }}
												>
													{pod.ip}
												</span>
												{pod.restarts > 0 && (
													<span
														className="text-[9px] px-1.5 py-0.5 rounded-full"
														style={{
															background: "var(--status-warn-subtle)",
															color: "var(--status-warn-text)",
														}}
													>
														{pod.restarts}↻
													</span>
												)}
												<Badge
													className="text-[8px] px-1 py-0 rounded shrink-0"
													style={
														pod.status === "Running"
															? {
																	background: "var(--status-up-subtle)",
																	color: "var(--status-up-text)",
																}
															: {
																	background: "var(--status-down-subtle)",
																	color: "var(--status-down-text)",
																}
													}
												>
													{pod.status}
												</Badge>
											</div>
										))}
									</div>
								</Card>
							)}

							{/* HPA */}
							{deployment && (
								<Card
									className="p-5 rounded"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--color-lavender-border)",
										boxShadow: "var(--card-shadow)",
									}}
								>
									<div className="flex items-center justify-between mb-4">
										<h4
											className="text-xs font-semibold flex items-center gap-1.5"
											style={{ color: "var(--text-secondary)" }}
										>
											<TrendingUp
												className="w-3.5 h-3.5"
												style={{ color: "var(--color-lavender)" }}
											/>
											Auto-Scale (HPA)
										</h4>
										{hpaInfo && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => deleteHPAMutation.mutate()}
												disabled={deleteHPAMutation.isPending}
												className="text-[9px] rounded h-6 px-2"
												style={{
													borderColor: "var(--status-down-border)",
													color: "var(--status-down-text)",
												}}
											>
												Kaldır
											</Button>
										)}
									</div>

									{hpaInfo && (
										<div className="grid grid-cols-4 gap-2 mb-4">
											{[
												{
													label: "Min",
													value: (hpaInfo as any).min_replicas,
													color: "var(--color-lavender)",
												},
												{
													label: "Max",
													value: (hpaInfo as any).max_replicas,
													color: "var(--color-lavender)",
												},
												{
													label: "Mevcut",
													value: (hpaInfo as any).current_replicas,
													color: "var(--color-blue)",
												},
												{
													label: "CPU Hedef",
													value: (hpaInfo as any).cpu_target_percent
														? `%${(hpaInfo as any).cpu_target_percent}`
														: "-",
													color: "var(--status-up)",
												},
											].map((s) => (
												<div
													key={s.label}
													className="p-2 rounded text-center"
													style={{
														background: "var(--surface-sunken)",
														border: "1.5px solid var(--border-default)",
													}}
												>
													<p
														className="text-[9px] uppercase tracking-wider mb-0.5"
														style={{ color: "var(--text-faint)" }}
													>
														{s.label}
													</p>
													<p
														className="text-base font-bold"
														style={{ color: s.color }}
													>
														{s.value}
													</p>
												</div>
											))}
										</div>
									)}

									<div className="grid grid-cols-3 gap-3 mb-3">
										<div>
											<label
												className="text-[9px] uppercase tracking-wider block mb-1"
												style={{ color: "var(--text-faint)" }}
											>
												Min
											</label>
											<div className="flex items-center gap-1">
												<button
													onClick={() => setHpaMin(Math.max(1, hpaMin - 1))}
													aria-label="Decrease minimum replicas"
													className="w-6 h-6 rounded flex items-center justify-center"
													style={{
														border: "2px solid var(--color-lavender-border)",
														color: "var(--color-lavender)",
													}}
												>
													<Minus className="w-2.5 h-2.5" />
												</button>
												<span
													className="text-sm font-bold w-5 text-center"
													style={{ color: "var(--text-secondary)" }}
												>
													{hpaMin}
												</span>
												<button
													onClick={() => setHpaMin(hpaMin + 1)}
													aria-label="Increase minimum replicas"
													className="w-6 h-6 rounded flex items-center justify-center"
													style={{
														border: "2px solid var(--color-lavender-border)",
														color: "var(--color-lavender)",
													}}
												>
													<Plus className="w-2.5 h-2.5" />
												</button>
											</div>
										</div>
										<div>
											<label
												className="text-[9px] uppercase tracking-wider block mb-1"
												style={{ color: "var(--text-faint)" }}
											>
												Max
											</label>
											<div className="flex items-center gap-1">
												<button
													onClick={() =>
														setHpaMax(Math.max(hpaMin, hpaMax - 1))
													}
													aria-label="Decrease maximum replicas"
													className="w-6 h-6 rounded flex items-center justify-center"
													style={{
														border: "2px solid var(--color-lavender-border)",
														color: "var(--color-lavender)",
													}}
												>
													<Minus className="w-2.5 h-2.5" />
												</button>
												<span
													className="text-sm font-bold w-5 text-center"
													style={{ color: "var(--text-secondary)" }}
												>
													{hpaMax}
												</span>
												<button
													onClick={() => setHpaMax(hpaMax + 1)}
													aria-label="Increase maximum replicas"
													className="w-6 h-6 rounded flex items-center justify-center"
													style={{
														border: "2px solid var(--color-lavender-border)",
														color: "var(--color-lavender)",
													}}
												>
													<Plus className="w-2.5 h-2.5" />
												</button>
											</div>
										</div>
										<div>
											<label
												className="text-[9px] uppercase tracking-wider block mb-1"
												style={{ color: "var(--text-faint)" }}
											>
												CPU %
											</label>
											<Input
												type="number"
												value={hpaCpu}
												onChange={(e) => setHpaCpu(Number(e.target.value))}
												min={10}
												max={95}
												className="rounded text-xs h-7"
												style={{
													background: "var(--input-bg)",
													borderColor: "var(--input-border)",
													color: "var(--text-secondary)",
												}}
											/>
										</div>
									</div>

									<div
										className="p-2 rounded text-[10px] leading-relaxed mb-3"
										style={{
											background: "var(--color-lavender-subtle)",
											border: "2px solid var(--color-lavender-border)",
											color: "var(--text-muted)",
										}}
									>
										CPU &gt; %{hpaCpu} olduğunda replica sayısı otomatik olarak{" "}
										{hpaMin}–{hpaMax} arasında ayarlanır.
									</div>

									<Button
										onClick={() => hpaMutation.mutate()}
										disabled={hpaMutation.isPending}
										className="w-full text-white rounded h-8 text-xs"
										style={{ background: "var(--color-lavender)" }}
									>
										{hpaMutation.isPending ? (
											<>
												<Loader2 className="w-3 h-3 mr-1 animate-spin" />{" "}
												Uygulanıyor...
											</>
										) : (
											<>
												<TrendingUp className="w-3 h-3 mr-1" />{" "}
												{hpaInfo ? "HPA Güncelle" : "HPA Oluştur"}
											</>
										)}
									</Button>
								</Card>
							)}
						</>
					)}
				</div>
			)}

			{/* ──── Agent Mode ──── */}
			{k8sMode === "agent" && (
				<Card
					className="p-6 rounded"
					style={{
						background: "var(--surface-card)",
						border: "2px solid var(--status-up-border)",
						boxShadow: "var(--card-shadow)",
					}}
				>
					<div className="flex items-center gap-2 mb-5">
						<Terminal
							className="w-4 h-4"
							style={{ color: "var(--status-up)" }}
						/>
						<h3
							className="text-sm font-semibold"
							style={{ color: "var(--text-secondary)" }}
						>
							Agent Aracılığıyla Scale
						</h3>
					</div>

					<div className="space-y-4">
						{/* Instance count */}
						<div>
							<label
								className="text-[10px] uppercase tracking-wider block mb-2"
								style={{ color: "var(--text-muted)" }}
							>
								Instance Sayısı
							</label>
							<div className="flex items-center gap-3">
								<button
									onClick={() =>
										setScaleInstances(Math.max(0, scaleInstances - 1))
									}
									aria-label="Decrease instance count"
									className="w-8 h-8 rounded flex items-center justify-center transition-all"
									style={{
										border: "2px solid var(--status-up-border)",
										color: "var(--status-up)",
									}}
								>
									<Minus className="w-3.5 h-3.5" />
								</button>
								<span
									className="text-2xl font-bold w-10 text-center"
									style={{ color: "var(--text-secondary)" }}
								>
									{scaleInstances}
								</span>
								<button
									onClick={() =>
										setScaleInstances(Math.min(32, scaleInstances + 1))
									}
									aria-label="Increase instance count"
									className="w-8 h-8 rounded flex items-center justify-center transition-all"
									style={{
										border: "2px solid var(--status-up-border)",
										color: "var(--status-up)",
									}}
								>
									<Plus className="w-3.5 h-3.5" />
								</button>
								<div className="flex gap-1 ml-2">
									{[1, 2, 4, 8].map((n) => (
										<button
											key={n}
											onClick={() => setScaleInstances(n)}
											className="px-2.5 py-1 rounded text-[10px] font-medium border-2 transition-all"
											style={
												scaleInstances === n
													? {
															background: "var(--status-up-subtle)",
															color: "var(--status-up-text)",
															borderColor: "var(--status-up-border)",
														}
													: {
															color: "var(--text-muted)",
															borderColor: "var(--border-default)",
														}
											}
										>
											{n}x
										</button>
									))}
								</div>
							</div>
						</div>

						{/* Strategy */}
						<div>
							<label
								className="text-[10px] uppercase tracking-wider block mb-2"
								style={{ color: "var(--text-muted)" }}
							>
								LB Stratejisi
							</label>
							<div className="grid grid-cols-3 gap-2">
								{[
									{
										value: "round_robin" as const,
										label: "Round Robin",
										desc: "Sırayla dağıt",
									},
									{
										value: "least_conn" as const,
										label: "Least Conn",
										desc: "En az bağlantı",
									},
									{
										value: "ip_hash" as const,
										label: "IP Hash",
										desc: "IP bazlı sticky",
									},
								].map((s) => (
									<button
										key={s.value}
										onClick={() => setScaleStrategy(s.value)}
										className="p-3 rounded border-2 text-left transition-all"
										style={
											scaleStrategy === s.value
												? {
														borderColor: "var(--status-up-border)",
														background: "var(--status-up-subtle)",
													}
												: { borderColor: "var(--border-default)" }
										}
									>
										<p
											className="text-xs font-semibold mb-0.5"
											style={{
												color:
													scaleStrategy === s.value
														? "var(--status-up-text)"
														: "var(--text-secondary)",
											}}
										>
											{s.label}
										</p>
										<p
											className="text-[10px]"
											style={{ color: "var(--text-faint)" }}
										>
											{s.desc}
										</p>
									</button>
								))}
							</div>
						</div>

						{/* Info */}
						<div
							className="p-3 rounded text-[10px] leading-relaxed"
							style={{
								background: "var(--status-up-subtle)",
								border: "2px solid var(--status-up-border)",
								color: "var(--text-muted)",
							}}
						>
							Komut WebSocket üzerinden agent'a iletilir.
							<code
								className="font-mono px-1 rounded mx-1"
								style={{ background: "var(--surface-sunken)" }}
							>
								NANONET_SCALE_CMD
							</code>
							tanımlıysa çalıştırılır; yoksa sadece acknowledge edilir.
						</div>

						<Button
							onClick={handleScale}
							disabled={scaleLoading}
							className="w-full text-white rounded h-9 text-sm font-medium"
							style={{ background: "var(--status-up)" }}
						>
							{scaleLoading ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
									Gönderiliyor...
								</>
							) : (
								<>
									<Layers className="w-4 h-4 mr-2" /> {scaleInstances} Instance
									— {scaleStrategy}
								</>
							)}
						</Button>
					</div>
				</Card>
			)}
		</div>
	);
}
