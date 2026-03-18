import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CalendarClock,
	CheckCircle2,
	Clock,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type MaintenanceWindow, maintenanceApi } from "@/api/maintenance";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface MaintenanceTabProps {
	serviceId: string;
}

function windowStatus(w: MaintenanceWindow): "active" | "upcoming" | "past" {
	const now = Date.now();
	const start = new Date(w.starts_at).getTime();
	const end = new Date(w.ends_at).getTime();
	if (now >= start && now < end) return "active";
	if (now >= end) return "past";
	return "upcoming";
}

export function MaintenanceTab({ serviceId }: MaintenanceTabProps) {
	const queryClient = useQueryClient();
	const [starts, setStarts] = useState("");
	const [ends, setEnds] = useState("");
	const [reason, setReason] = useState("");
	const [filter, setFilter] = useState<"all" | "upcoming" | "active" | "past">(
		"all",
	);

	const { data: windows = [], isLoading } = useQuery({
		queryKey: ["maintenance", serviceId],
		queryFn: () => maintenanceApi.list(serviceId),
		enabled: !!serviceId,
	});

	const createMutation = useMutation({
		mutationFn: () =>
			maintenanceApi.create(serviceId, {
				starts_at: new Date(starts).toISOString(),
				ends_at: new Date(ends).toISOString(),
				reason: reason || undefined,
			}),
		onSuccess: () => {
			toast.success("Bakım penceresi oluşturuldu");
			setStarts("");
			setEnds("");
			setReason("");
			queryClient.invalidateQueries({ queryKey: ["maintenance", serviceId] });
		},
		onError: () => toast.error("Bakım penceresi oluşturulamadı"),
	});

	const deleteMutation = useMutation({
		mutationFn: (windowId: string) =>
			maintenanceApi.delete(serviceId, windowId),
		onSuccess: () => {
			toast.success("Bakım penceresi silindi");
			queryClient.invalidateQueries({ queryKey: ["maintenance", serviceId] });
		},
		onError: () => toast.error("Bakım penceresi silinemedi"),
	});

	const filtered = windows.filter((w) => {
		if (filter === "all") return true;
		return windowStatus(w) === filter;
	});

	const counts = {
		active: windows.filter((w) => windowStatus(w) === "active").length,
		upcoming: windows.filter((w) => windowStatus(w) === "upcoming").length,
		past: windows.filter((w) => windowStatus(w) === "past").length,
	};

	return (
		<div className="space-y-4">
			{/* Create form */}
			<Card
				className="p-5 rounded"
				style={{
					background: "var(--surface-card)",
					border: "2px solid var(--color-blue-border)",
					boxShadow: "var(--card-shadow)",
				}}
			>
				<div className="flex items-center gap-2 mb-4">
					<CalendarClock
						className="w-4 h-4"
						style={{ color: "var(--color-blue)" }}
					/>
					<h3
						className="text-sm font-semibold"
						style={{ color: "var(--text-secondary)" }}
					>
						Yeni Bakım Penceresi
					</h3>
				</div>

				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label
								className="text-[10px] uppercase tracking-wider block mb-1"
								style={{ color: "var(--text-muted)" }}
							>
								Başlangıç
							</label>
							<Input
								type="datetime-local"
								value={starts}
								onChange={(e) => setStarts(e.target.value)}
								className="rounded text-xs h-8"
								style={{
									background: "var(--input-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							/>
						</div>
						<div>
							<label
								className="text-[10px] uppercase tracking-wider block mb-1"
								style={{ color: "var(--text-muted)" }}
							>
								Bitiş
							</label>
							<Input
								type="datetime-local"
								value={ends}
								onChange={(e) => setEnds(e.target.value)}
								className="rounded text-xs h-8"
								style={{
									background: "var(--input-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							/>
						</div>
					</div>

					<Input
						placeholder="Sebep (isteğe bağlı)"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						className="rounded text-xs h-8"
						style={{
							background: "var(--input-bg)",
							borderColor: "var(--input-border)",
							color: "var(--text-secondary)",
						}}
					/>

					<div className="flex justify-end">
						<Button
							size="sm"
							onClick={() => createMutation.mutate()}
							disabled={createMutation.isPending || !starts || !ends}
							className="rounded text-xs h-8 text-white"
							style={{
								background: "var(--gradient-btn-primary)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							{createMutation.isPending ? (
								<Loader2 className="w-3 h-3 mr-1 animate-spin" />
							) : (
								<Plus className="w-3 h-3 mr-1" />
							)}
							Oluştur
						</Button>
					</div>
				</div>
			</Card>

			{/* Window list */}
			<Card
				className="p-5 rounded"
				style={{
					background: "var(--surface-card)",
					border: "2px solid var(--border-default)",
					boxShadow: "var(--card-shadow)",
				}}
			>
				<div className="flex items-center justify-between mb-4">
					<h3
						className="text-sm font-semibold"
						style={{ color: "var(--text-secondary)" }}
					>
						Bakım Pencereleri
					</h3>

					{/* Filter tabs */}
					<div className="flex items-center gap-1">
						{(
							[
								{ key: "all", label: `Tümü (${windows.length})` },
								{ key: "active", label: `Aktif (${counts.active})` },
								{ key: "upcoming", label: `Bekleyen (${counts.upcoming})` },
								{ key: "past", label: `Geçmiş (${counts.past})` },
							] as const
						).map((f) => (
							<button
								key={f.key}
								onClick={() => setFilter(f.key)}
								className="px-2 py-1 rounded text-[10px] font-medium border-2 transition-all"
								style={
									filter === f.key
										? {
												background: "var(--color-blue-subtle)",
												borderColor: "var(--color-blue-border)",
												color: "var(--color-blue)",
											}
										: { borderColor: "transparent", color: "var(--text-faint)" }
								}
							>
								{f.label}
							</button>
						))}
					</div>
				</div>

				{isLoading ? (
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-16 rounded animate-pulse"
								style={{ background: "var(--surface-sunken)" }}
							/>
						))}
					</div>
				) : filtered.length === 0 ? (
					<EmptyState
						icon={CalendarClock}
						title="Bakım penceresi yok"
						description={
							filter === "all"
								? "Henüz bakım penceresi tanımlanmamış. Yukarıdan yeni bir pencere oluşturabilirsiniz."
								: `Bu filtrede (${filter}) bakım penceresi bulunmuyor.`
						}
					/>
				) : (
					<div className="space-y-2">
						{filtered.map((w) => {
							const status = windowStatus(w);
							const isPast = status === "past";
							const isActive = status === "active";

							const statusStyle = isActive
								? {
										bg: "var(--status-warn-subtle)",
										border: "var(--status-warn-border)",
										color: "var(--status-warn-text)",
										label: "AKTİF",
										Icon: AlertTriangle,
									}
								: isPast
									? {
											bg: "var(--surface-sunken)",
											border: "var(--border-subtle)",
											color: "var(--text-faint)",
											label: "GEÇMİŞ",
											Icon: CheckCircle2,
										}
									: {
											bg: "var(--color-blue-subtle)",
											border: "var(--color-blue-border)",
											color: "var(--color-blue)",
											label: "BEKLEYEN",
											Icon: Clock,
										};

							return (
								<div
									key={w.id}
									className="flex items-start justify-between gap-3 p-3 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: `2px solid ${isActive ? "var(--status-warn-border)" : "var(--border-subtle)"}`,
									}}
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 mb-1">
											<Badge
												className="text-[9px] px-1.5 py-0 rounded border font-bold"
												style={{
													background: statusStyle.bg,
													color: statusStyle.color,
													borderColor: statusStyle.border,
												}}
											>
												<statusStyle.Icon className="w-2.5 h-2.5 mr-0.5 inline" />
												{statusStyle.label}
											</Badge>
											{w.reason && (
												<span
													className="text-xs truncate"
													style={{ color: "var(--text-secondary)" }}
												>
													{w.reason}
												</span>
											)}
										</div>
										<p
											className="text-[10px]"
											style={{ color: "var(--text-muted)" }}
										>
											{new Date(w.starts_at).toLocaleString("tr-TR", {
												day: "2-digit",
												month: "short",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
											{" → "}
											{new Date(w.ends_at).toLocaleString("tr-TR", {
												day: "2-digit",
												month: "short",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
									{!isPast && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => deleteMutation.mutate(w.id)}
											disabled={deleteMutation.isPending}
											className="shrink-0 rounded h-7 text-[10px]"
											style={{
												borderColor: "var(--status-down-border)",
												color: "var(--status-down-text)",
											}}
										>
											<Trash2 className="w-3 h-3" />
										</Button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</Card>
		</div>
	);
}
