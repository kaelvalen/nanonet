import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type AlertRules, metricsApi } from "@/api/metrics";

interface AlertRulesTabProps {
	serviceId: string;
}

const DEFAULT_RULES: Omit<AlertRules, "service_id" | "is_default"> = {
	cpu_threshold: 80,
	memory_threshold_mb: 2048,
	latency_threshold_ms: 1000,
	error_rate_threshold: 5,
};

const FIELDS: {
	key: keyof Omit<AlertRules, "service_id" | "is_default">;
	label: string;
	unit: string;
	min: number;
	max: number;
	description: string;
	color: string;
}[] = [
	{
		key: "cpu_threshold",
		label: "CPU Eşiği",
		unit: "%",
		min: 1,
		max: 100,
		description: "Bu değeri aşan CPU kullanımında alert tetiklenir",
		color: "#2dd4bf",
	},
	{
		key: "memory_threshold_mb",
		label: "Bellek Eşiği",
		unit: "MB",
		min: 1,
		max: 999999,
		description: "Bu değeri aşan bellek kullanımında alert tetiklenir",
		color: "#22d3ee",
	},
	{
		key: "latency_threshold_ms",
		label: "Gecikme Eşiği",
		unit: "ms",
		min: 1,
		max: 999999,
		description: "Bu değeri aşan yanıt süresinde alert tetiklenir",
		color: "#818cf8",
	},
	{
		key: "error_rate_threshold",
		label: "Hata Oranı Eşiği",
		unit: "%",
		min: 0,
		max: 100,
		description: "Bu değeri aşan hata oranında alert tetiklenir",
		color: "#fb7185",
	},
];

export function AlertRulesTab({ serviceId }: AlertRulesTabProps) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<Omit<
		AlertRules,
		"service_id" | "is_default"
	> | null>(null);

	const { data: rules, isLoading } = useQuery({
		queryKey: ["alertRules", serviceId],
		queryFn: () => metricsApi.getAlertRules(serviceId),
		enabled: !!serviceId,
	});

	const saveMutation = useMutation({
		mutationFn: (data: Omit<AlertRules, "service_id" | "is_default">) =>
			metricsApi.updateAlertRules(serviceId, data),
		onSuccess: () => {
			toast.success("Alert eşikleri güncellendi");
			setForm(null);
			queryClient.invalidateQueries({ queryKey: ["alertRules", serviceId] });
		},
		onError: () => toast.error("Alert eşikleri güncellenemedi"),
	});

	const current =
		form ??
		(rules
			? {
					cpu_threshold: rules.cpu_threshold,
					memory_threshold_mb: rules.memory_threshold_mb,
					latency_threshold_ms: rules.latency_threshold_ms,
					error_rate_threshold: rules.error_rate_threshold,
				}
			: DEFAULT_RULES);

	const isDirty = form !== null;

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-[140px] rounded-lg animate-pulse"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div
				className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<span
						className="w-7 h-7 rounded flex items-center justify-center shrink-0"
						style={{
							background: "var(--color-teal-subtle)",
							border: "1px solid var(--color-teal-border)",
						}}
					>
						<Bell className="w-3.5 h-3.5" style={{ color: "var(--color-teal)" }} />
					</span>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<p
								className="text-xs font-bold leading-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Alert Eşikleri
							</p>
							{rules?.is_default && (
								<span
									className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
										color: "var(--text-faint)",
									}}
								>
									varsayılan
								</span>
							)}
						</div>
						<p
							className="text-[10px] leading-tight mt-0.5"
							style={{ color: "var(--text-muted)" }}
						>
							Eşikleri aşan metrikler otomatik uyarı tetikler
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{isDirty && (
						<button
							type="button"
							onClick={() => setForm(null)}
							className="flex items-center gap-1 px-2.5 h-8 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
							style={{
								color: "var(--text-muted)",
								border: "1px solid var(--border-default)",
							}}
						>
							<RotateCcw className="w-3 h-3" /> İptal
						</button>
					)}
					<button
						type="button"
						onClick={() => saveMutation.mutate(current)}
						disabled={!isDirty || saveMutation.isPending}
						className="flex items-center gap-1.5 px-3 h-8 rounded text-[10px] font-bold uppercase tracking-wider text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
						style={{
							background: isDirty
								? "var(--gradient-btn-primary)"
								: "var(--surface-sunken)",
							boxShadow: isDirty ? "var(--btn-shadow)" : undefined,
							color: isDirty ? "white" : "var(--text-faint)",
						}}
					>
						{saveMutation.isPending ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<Save className="w-3 h-3" />
						)}
						Kaydet
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{FIELDS.map(({ key, label, unit, min, max, description, color }) => {
					const value = current[key];
					const pct = Math.min((value / max) * 100, 100);
					const dirty = isDirty && form?.[key] !== undefined;

					return (
						<div
							key={key}
							className="relative p-4 rounded-lg flex flex-col gap-3 overflow-hidden"
							style={{
								background: "var(--surface-card)",
								border: `1px solid ${dirty ? color : "var(--border-default)"}`,
							}}
						>
							<div
								className="absolute top-0 left-0 right-0 h-px"
								style={{ background: color, opacity: 0.4 }}
							/>

							<div className="flex items-center justify-between gap-2">
								<p
									className="text-[10px] uppercase tracking-[0.2em] font-bold"
									style={{ color }}
								>
									{label}
								</p>
								<div className="flex items-baseline gap-1">
									<span
										className="text-base font-mono font-bold tabular-nums leading-none"
										style={{ color: "var(--text-primary)" }}
									>
										{value}
									</span>
									<span
										className="text-[10px] font-mono"
										style={{ color: "var(--text-faint)" }}
									>
										{unit}
									</span>
								</div>
							</div>

							<div
								className="h-1 rounded-full overflow-hidden"
								style={{ background: "var(--border-track)" }}
							>
								<div
									className="h-full rounded-full transition-all"
									style={{ width: `${pct}%`, background: color }}
								/>
							</div>

							<input
								type="number"
								min={min}
								max={max}
								value={value}
								onChange={(e) => {
									const v = parseFloat(e.target.value);
									if (!Number.isNaN(v)) {
										setForm({ ...current, [key]: v });
									}
								}}
								className="w-full h-9 px-2.5 rounded text-xs font-mono tabular-nums focus:outline-none transition-colors"
								style={{
									background: "var(--input-bg)",
									border: `1px solid ${dirty ? color : "var(--input-border)"}`,
									color: "var(--text-primary)",
								}}
							/>

							<p
								className="text-[10px] leading-snug"
								style={{ color: "var(--text-muted)" }}
							>
								{description}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
