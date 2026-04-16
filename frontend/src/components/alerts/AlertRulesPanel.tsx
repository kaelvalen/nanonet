import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Cpu,
	Gauge,
	Info,
	Loader2,
	MemoryStick,
	RefreshCw,
	Save,
	Settings2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type AlertRules, metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { StatusDot } from "@/components/ui/status-atoms";

type RulesDraft = Omit<AlertRules, "service_id" | "is_default">;

const DEFAULT_DRAFT: RulesDraft = {
	cpu_threshold: 80,
	memory_threshold_mb: 1024,
	latency_threshold_ms: 1000,
	error_rate_threshold: 0.1,
};

export function AlertRulesPanel() {
	const queryClient = useQueryClient();
	const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
		null,
	);
	const [draft, setDraft] = useState<RulesDraft | null>(null);

	const { data: services = [], isLoading: servicesLoading } = useQuery({
		queryKey: ["services"],
		queryFn: servicesApi.list,
		staleTime: 30_000,
	});

	const {
		data: rules,
		isLoading: rulesLoading,
		refetch: refetchRules,
	} = useQuery({
		queryKey: ["alert-rules", selectedServiceId],
		queryFn: () => metricsApi.getAlertRules(selectedServiceId ?? ""),
		enabled: !!selectedServiceId,
		staleTime: 10_000,
	});

	const effectiveDraft: RulesDraft =
		draft ??
		(rules
			? {
					cpu_threshold: rules.cpu_threshold,
					memory_threshold_mb: rules.memory_threshold_mb,
					latency_threshold_ms: rules.latency_threshold_ms,
					error_rate_threshold: rules.error_rate_threshold,
				}
			: DEFAULT_DRAFT);

	const saveMutation = useMutation({
		mutationFn: () =>
			metricsApi.updateAlertRules(selectedServiceId ?? "", effectiveDraft),
		onSuccess: () => {
			toast.success("Eşik değerleri kaydedildi");
			queryClient.invalidateQueries({
				queryKey: ["alert-rules", selectedServiceId],
			});
			refetchRules();
		},
		onError: () => toast.error("Kaydetme başarısız"),
	});

	const setField = <K extends keyof RulesDraft>(key: K, val: RulesDraft[K]) => {
		setDraft((prev) => ({ ...(prev ?? effectiveDraft), [key]: val }));
	};

	const isDirty =
		draft !== null &&
		rules !== undefined &&
		(draft.cpu_threshold !== rules.cpu_threshold ||
			draft.memory_threshold_mb !== rules.memory_threshold_mb ||
			draft.latency_threshold_ms !== rules.latency_threshold_ms ||
			draft.error_rate_threshold !== rules.error_rate_threshold);

	const fields = [
		{
			key: "cpu_threshold" as const,
			label: "CPU eşiği",
			icon: Cpu,
			unit: "%",
			min: 10,
			max: 100,
			step: 5,
		},
		{
			key: "memory_threshold_mb" as const,
			label: "Bellek eşiği",
			icon: MemoryStick,
			unit: "MB",
			min: 64,
			max: 32768,
			step: 64,
		},
		{
			key: "latency_threshold_ms" as const,
			label: "Latency eşiği",
			icon: Gauge,
			unit: "ms",
			min: 50,
			max: 10000,
			step: 50,
		},
		{
			key: "error_rate_threshold" as const,
			label: "Hata oranı eşiği",
			icon: Activity,
			unit: "",
			min: 0,
			max: 1,
			step: 0.01,
		},
	];

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<div className="flex items-center gap-2.5">
				<div
					className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
					style={{
						background: "var(--color-teal-subtle)",
						border: "1px solid var(--color-teal-border)",
					}}
				>
					<Settings2
						className="w-3.5 h-3.5"
						style={{ color: "var(--color-teal)" }}
					/>
				</div>
				<div className="min-w-0">
					<h3
						className="text-sm font-semibold leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						Eşik ayarları
					</h3>
					<p
						className="text-[11px] mt-1"
						style={{ color: "var(--text-faint)" }}
					>
						Servis bazlı alert limitleri
					</p>
				</div>
			</div>

			{/* Service picker */}
			<div className="flex flex-wrap gap-1.5">
				{servicesLoading ? (
					<div
						className="flex items-center gap-2 text-xs"
						style={{ color: "var(--text-faint)" }}
					>
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
						Servisler yükleniyor…
					</div>
				) : services.length === 0 ? (
					<p className="text-xs" style={{ color: "var(--text-faint)" }}>
						Henüz servis yok.
					</p>
				) : (
					services.map((svc) => (
						<button
							type="button"
							key={svc.id}
							onClick={() => {
								setSelectedServiceId(svc.id);
								setDraft(null);
							}}
							className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors"
							style={
								selectedServiceId === svc.id
									? {
											background: "var(--color-teal-subtle)",
											color: "var(--color-teal)",
											border: "1px solid var(--color-teal-border)",
										}
									: {
											background: "var(--surface-sunken)",
											color: "var(--text-muted)",
											border: "1px solid var(--border-default)",
										}
							}
						>
							<StatusDot status={svc.status} size={6} />
							<span className="truncate max-w-32">{svc.name}</span>
						</button>
					))
				)}
			</div>

			{/* Picker prompt */}
			{!selectedServiceId && (
				<div
					className="p-8 text-center rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px dashed var(--border-default)",
					}}
				>
					<Settings2
						className="w-6 h-6 mx-auto mb-2 opacity-30"
						style={{ color: "var(--text-faint)" }}
					/>
					<p
						className="text-xs font-medium"
						style={{ color: "var(--text-muted)" }}
					>
						Eşik ayarlamak için servis seçin
					</p>
				</div>
			)}

			{/* Form */}
			{selectedServiceId &&
				(rulesLoading ? (
					<div
						className="flex items-center gap-2 py-6 text-xs justify-center"
						style={{ color: "var(--text-faint)" }}
					>
						<Loader2 className="w-4 h-4 animate-spin" />
						Yükleniyor…
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{rules?.is_default === true && (
							<div
								className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
								style={{
									background: "var(--color-blue-subtle)",
									border: "1px solid var(--color-blue-border)",
									color: "var(--color-blue-text)",
								}}
							>
								<Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
								<span className="leading-relaxed">
									Bu servis şu an global varsayılan eşikleri kullanıyor. Kaydet
									ile kendi değerlerini ata.
								</span>
							</div>
						)}

						{fields.map((f) => {
							const value = effectiveDraft[f.key];
							return (
								<div
									key={f.key}
									className="p-3 rounded-lg"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
									}}
								>
									<div className="flex items-center gap-2 mb-3">
										<f.icon
											className="w-3.5 h-3.5"
											style={{ color: "var(--text-muted)" }}
										/>
										<span
											className="text-xs font-semibold flex-1"
											style={{ color: "var(--text-primary)" }}
										>
											{f.label}
										</span>
										<div className="flex items-center gap-1">
											<Input
												type="number"
												value={value}
												min={f.min}
												max={f.max}
												step={f.step}
												onChange={(e) =>
													setField(f.key, Number(e.target.value) as never)
												}
												className="w-20 h-7 text-xs text-right rounded font-mono"
												style={{
													background: "var(--input-bg)",
													borderColor: "var(--input-border)",
												}}
											/>
											{f.unit && (
												<span
													className="text-[10px] w-5"
													style={{ color: "var(--text-faint)" }}
												>
													{f.unit}
												</span>
											)}
										</div>
									</div>
									<Slider
										value={[value]}
										min={f.min}
										max={f.max}
										step={f.step}
										onValueChange={([v]) => setField(f.key, v as never)}
									/>
								</div>
							);
						})}

						{/* Actions */}
						<div className="flex items-center gap-2 justify-end pt-1">
							{isDirty && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setDraft(null)}
									className="h-8 text-xs"
								>
									<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
									Sıfırla
								</Button>
							)}
							<Button
								onClick={() => saveMutation.mutate()}
								disabled={!isDirty || saveMutation.isPending}
								size="sm"
								className="h-8 text-xs"
								style={{
									background: isDirty
										? "var(--color-teal)"
										: "var(--surface-sunken)",
									color: isDirty ? "#fff" : "var(--text-faint)",
								}}
							>
								{saveMutation.isPending ? (
									<>
										<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
										Kaydediliyor…
									</>
								) : (
									<>
										<Save className="w-3.5 h-3.5 mr-1.5" />
										Kaydet
									</>
								)}
							</Button>
						</div>
					</div>
				))}
		</div>
	);
}
