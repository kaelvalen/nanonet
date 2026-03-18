import {
	AlertTriangle,
	Loader2,
	Minus,
	Package2,
	PackageCheck,
	PackageX,
	Plus,
	RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import type { DeploymentInfo } from "@/api/k8s";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Service } from "@/types/service";

export interface NanonetTabProps {
	nanonetServicesLoading: boolean;
	nanonetServices: Service[];
	deployments: DeploymentInfo[];
	isAvailable: boolean;
	deployForms: Record<
		string,
		{ image: string; replicas: number; open: boolean }
	>;
	setDeployForms: React.Dispatch<
		React.SetStateAction<
			Record<string, { image: string; replicas: number; open: boolean }>
		>
	>;
	deployMutation: any;
	undeployMutation: any;
	refetchNanonetServices: () => void;
	refetchDeployments: () => void;
	slugifyForK8s: (name: string) => string;
}

function StatusDot({
	ready,
	size = "sm",
}: {
	ready: boolean;
	size?: "sm" | "md";
}) {
	const sz = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
	return (
		<div className="relative shrink-0">
			<div
				className={`${sz} rounded-full`}
				style={{
					backgroundColor: ready ? "var(--status-up)" : "var(--status-down)",
				}}
			/>
			{ready && (
				<div
					className={`absolute inset-0 ${sz} rounded-full animate-pulse-ring`}
					style={{ backgroundColor: "var(--status-up)" }}
				/>
			)}
		</div>
	);
}

export function NanonetTab({
	nanonetServicesLoading,
	nanonetServices,
	deployments,
	isAvailable,
	deployForms,
	setDeployForms,
	deployMutation,
	undeployMutation,
	refetchNanonetServices,
	refetchDeployments,
	slugifyForK8s,
}: NanonetTabProps) {
	return (
		<motion.div
			key="nanonet"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			className="space-y-4"
		>
			<div className="flex items-center justify-between">
				<div>
					<p
						className="text-sm font-semibold"
						style={{ color: "var(--text-secondary)" }}
					>
						NanoNet Servisleri
					</p>
					<p
						className="text-[10px] mt-0.5"
						style={{ color: "var(--text-faint)" }}
					>
						Agent tarafından izlenen servisleri K8s cluster'ına dahil edin veya
						çıkarın
					</p>
				</div>
				<button
					onClick={() => {
						refetchNanonetServices();
						refetchDeployments();
					}}
					disabled={nanonetServicesLoading}
					className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border"
					style={{
						borderColor: "var(--border-subtle)",
						color: "var(--text-muted)",
					}}
				>
					{nanonetServicesLoading ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<RefreshCw className="w-3.5 h-3.5" />
					)}
					Yenile
				</button>
			</div>

			{!isAvailable && (
				<div
					className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs"
					style={{
						background: "var(--status-warn-subtle)",
						border: "1px solid var(--status-warn-border)",
						color: "var(--status-warn-text)",
					}}
				>
					<AlertTriangle className="w-4 h-4 shrink-0" />
					<span>
						Kubernetes bağlantısı yok — K8s'e dağıtmak için backend'de{" "}
						<code
							className="px-1 py-0.5 rounded font-mono text-[10px]"
							style={{
								background:
									"color-mix(in srgb, var(--status-warn) 15%, transparent)",
							}}
						>
							K8S_NAMESPACE
						</code>{" "}
						değişkenini tanımlayın.
					</span>
				</div>
			)}

			{nanonetServicesLoading && nanonetServices.length === 0 ? (
				<div
					className="flex items-center gap-2 py-6"
					style={{ color: "var(--text-faint)" }}
				>
					<Loader2 className="w-4 h-4 animate-spin" />
					<span className="text-xs">Servisler yükleniyor...</span>
				</div>
			) : nanonetServices.length === 0 ? (
				<Card
					className="p-8 rounded-xl text-center"
					style={{
						background: "var(--surface-glass)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Package2
						className="w-8 h-8 mx-auto mb-2 opacity-30"
						style={{ color: "var(--text-faint)" }}
					/>
					<p
						className="text-sm font-medium mb-1"
						style={{ color: "var(--text-muted)" }}
					>
						Henüz servis yok
					</p>
					<p className="text-xs" style={{ color: "var(--text-faint)" }}>
						Agent bağlandıktan sonra izlenen servisler burada görünür
					</p>
				</Card>
			) : (
				<div className="space-y-3">
					{nanonetServices.map((svc: Service) => {
						const slug = slugifyForK8s(svc.name);
						const isDeployed = deployments.some((d) => d.name === slug);
						const form = deployForms[svc.name] ?? {
							image: "",
							replicas: 1,
							open: false,
						};
						const isDeploying =
							deployMutation.isPending &&
							(deployMutation.variables as { name: string })?.name === svc.name;
						const isUndeploying =
							undeployMutation.isPending &&
							undeployMutation.variables === svc.name;

						return (
							<motion.div
								key={svc.id}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
							>
								<Card
									className="p-4 rounded-xl"
									style={{
										background: "var(--surface-glass)",
										border: `1px solid ${isDeployed ? "var(--color-teal-border)" : "var(--border-subtle)"}`,
									}}
								>
									{/* Header row */}
									<div className="flex items-center gap-3">
										<StatusDot ready={svc.status === "up"} />
										<div className="flex-1 min-w-0">
											<p
												className="text-xs font-semibold truncate"
												style={{ color: "var(--text-secondary)" }}
											>
												{svc.name}
											</p>
											<p
												className="text-[10px] mt-0.5"
												style={{
													color: "var(--text-faint)",
													fontFamily: "var(--font-mono)",
												}}
											>
												{svc.host}:{svc.port}
											</p>
										</div>

										{/* K8s deployment status */}
										{isDeployed ? (
											<Badge
												className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
												style={{
													background: "var(--color-teal-subtle)",
													color: "var(--color-teal)",
													borderColor: "var(--color-teal-border)",
												}}
											>
												<PackageCheck className="w-3 h-3 inline mr-1" />
												K8s'te
											</Badge>
										) : (
											<Badge
												className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
												style={{
													background: "var(--surface-sunken)",
													color: "var(--text-faint)",
													borderColor: "var(--border-subtle)",
												}}
											>
												K8s dışı
											</Badge>
										)}

										{/* Action buttons */}
										{isDeployed ? (
											<button
												onClick={() => {
													if (
														confirm(
															`"${svc.name}" K8s'ten kaldırılsın mı? (Deployment + Service + HPA silinir)`,
														)
													)
														undeployMutation.mutate(svc.name);
												}}
												disabled={isUndeploying}
												className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] border shrink-0 transition-opacity hover:opacity-80"
												style={{
													background:
														"color-mix(in srgb, var(--status-down) 10%, transparent)",
													borderColor: "var(--status-down-border)",
													color: "var(--status-down-text)",
												}}
											>
												{isUndeploying ? (
													<Loader2 className="w-3 h-3 animate-spin" />
												) : (
													<PackageX className="w-3 h-3" />
												)}
												K8s'ten Çıkar
											</button>
										) : (
											<button
												onClick={() =>
													setDeployForms((prev) => ({
														...prev,
														[svc.name]: { ...form, open: !form.open },
													}))
												}
												className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] border shrink-0 transition-all"
												style={
													form.open
														? {
																background: "var(--color-teal-subtle)",
																borderColor: "var(--color-teal-border)",
																color: "var(--color-teal)",
															}
														: {
																borderColor: "var(--color-teal-border)",
																color: "var(--color-teal)",
															}
												}
											>
												<Package2 className="w-3 h-3" />
												K8s'e Dahil Et
											</button>
										)}
									</div>

									{/* K8s slug info for deployed */}
									{isDeployed && (
										<div
											className="mt-2 flex items-center gap-1.5 text-[10px]"
											style={{ color: "var(--text-faint)" }}
										>
											<span>K8s adı:</span>
											<span
												style={{
													fontFamily: "var(--font-mono)",
													color: "var(--color-teal)",
												}}
											>
												{slug}
											</span>
											{deployments.find((d) => d.name === slug) &&
												(() => {
													const dep = deployments.find((d) => d.name === slug)!;
													return (
														<span
															style={{
																color:
																	dep.ready_replicas === dep.replicas &&
																	dep.replicas > 0
																		? "var(--status-up)"
																		: "var(--status-warn)",
															}}
														>
															· {dep.ready_replicas}/{dep.replicas} ready
														</span>
													);
												})()}
										</div>
									)}

									{/* Deploy form (expandable) */}
									{!isDeployed && form.open && (
										<div
											className="mt-3 pt-3 space-y-3"
											style={{ borderTop: "1px solid var(--border-subtle)" }}
										>
											<div>
												<p
													className="text-[10px] uppercase tracking-wider mb-1.5"
													style={{ color: "var(--text-muted)" }}
												>
													Container İmajı{" "}
													<span style={{ color: "var(--color-red, #e57373)" }}>
														*
													</span>
												</p>
												<Input
													placeholder={`nginx:latest, my-registry/${slug}:latest`}
													value={form.image}
													onChange={(e) => {
														const val = e.target.value;
														setDeployForms((prev) => ({
															...prev,
															[svc.name]: {
																...(prev[svc.name] ?? {
																	image: "",
																	replicas: 1,
																	open: true,
																}),
																image: val,
															},
														}));
													}}
													className="rounded-lg text-xs h-9"
													style={{
														background: "var(--input-bg)",
														borderColor: "var(--input-border)",
														color: "var(--text-secondary)",
														fontFamily: "var(--font-mono)",
													}}
												/>
												{!form.image.trim() && (
													<p
														className="text-[10px] mt-1"
														style={{ color: "var(--text-faint)" }}
													>
														Dağıtım için bir container imajı girin (örn:
														nginx:latest)
													</p>
												)}
											</div>
											<div className="flex items-end gap-3">
												<div>
													<p
														className="text-[10px] uppercase tracking-wider mb-1.5"
														style={{ color: "var(--text-muted)" }}
													>
														Replica
													</p>
													<div className="flex items-center gap-2">
														<button
															onClick={() =>
																setDeployForms((prev) => ({
																	...prev,
																	[svc.name]: {
																		...(prev[svc.name] ?? {
																			image: "",
																			replicas: 1,
																			open: true,
																		}),
																		replicas: Math.max(
																			1,
																			(prev[svc.name]?.replicas ?? 1) - 1,
																		),
																	},
																}))
															}
															aria-label="Decrease replicas"
															className="w-7 h-7 rounded-lg flex items-center justify-center"
															style={{
																border: "1px solid var(--color-teal-border)",
																color: "var(--color-teal)",
															}}
														>
															<Minus className="w-3 h-3" />
														</button>
														<span
															className="text-base font-bold w-6 text-center"
															style={{ color: "var(--text-secondary)" }}
														>
															{form.replicas}
														</span>
														<button
															onClick={() =>
																setDeployForms((prev) => ({
																	...prev,
																	[svc.name]: {
																		...(prev[svc.name] ?? {
																			image: "",
																			replicas: 1,
																			open: true,
																		}),
																		replicas: Math.min(
																			20,
																			(prev[svc.name]?.replicas ?? 1) + 1,
																		),
																	},
																}))
															}
															aria-label="Increase replicas"
															className="w-7 h-7 rounded-lg flex items-center justify-center"
															style={{
																border: "1px solid var(--color-teal-border)",
																color: "var(--color-teal)",
															}}
														>
															<Plus className="w-3 h-3" />
														</button>
													</div>
												</div>
												<Button
													onClick={() =>
														deployMutation.mutate({
															name: svc.name,
															image: form.image,
															port: svc.port,
															replicas: form.replicas,
														})
													}
													disabled={
														!form.image.trim() || isDeploying || !isAvailable
													}
													title={
														!isAvailable
															? "K8s bağlantısı yok"
															: !form.image.trim()
																? "Container imajı gerekli"
																: ""
													}
													className="flex-1 text-white rounded-xl h-9 text-xs"
													style={{
														background:
															!form.image.trim() || isDeploying || !isAvailable
																? "var(--text-faint)"
																: "var(--color-teal)",
													}}
												>
													{isDeploying ? (
														<>
															<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
															Dağıtılıyor...
														</>
													) : (
														<>
															<Package2 className="w-3.5 h-3.5 mr-1.5" />
															K8s'e Dağıt
														</>
													)}
												</Button>
											</div>
											<div
												className="text-[10px] px-3 py-2 rounded-lg"
												style={{
													background:
														"color-mix(in srgb, var(--color-teal) 8%, transparent)",
													border: "1px solid var(--color-teal-border)",
													color: "var(--text-faint)",
												}}
											>
												Deployment + ClusterIP Service oluşturulacak
												&nbsp;·&nbsp; K8s adı:{" "}
												<span
													style={{
														fontFamily: "var(--font-mono)",
														color: "var(--color-teal)",
													}}
												>
													{slug}
												</span>
												&nbsp;·&nbsp; Port:{" "}
												<span
													style={{
														fontFamily: "var(--font-mono)",
														color: "var(--color-teal)",
													}}
												>
													{svc.port}
												</span>
											</div>
										</div>
									)}
								</Card>
							</motion.div>
						);
					})}
				</div>
			)}
		</motion.div>
	);
}
