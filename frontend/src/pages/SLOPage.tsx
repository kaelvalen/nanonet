import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Clock,
	Flame,
	Loader2,
	Plus,
	Target,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import {
	type CreateSLOInput,
	type SLIType,
	type SLO,
	sloApi,
} from "@/api/slo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useServices } from "@/hooks/useServices";

const SLI_LABELS: Record<SLIType, { label: string; helper: string }> = {
	availability: {
		label: "Erişilebilirlik",
		helper: "status='up' örneklerinin toplam içindeki oranı",
	},
	latency: {
		label: "Gecikme",
		helper: "eşik altındaki örneklerin toplam içindeki oranı",
	},
	error_rate: {
		label: "Hata Oranı",
		helper: "eşik altındaki hata oranlı örneklerin toplam içindeki oranı",
	},
};

export function SLOPage() {
	const qc = useQueryClient();
	const { services } = useServices();
	const [draft, setDraft] = useState<CreateSLOInput | null>(null);

	const { data: slos = [], isLoading } = useQuery({
		queryKey: ["slos"],
		queryFn: () => sloApi.list(),
	});

	const createMut = useMutation({
		mutationFn: sloApi.create,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["slos"] });
			setDraft(null);
			toast.success("SLO oluşturuldu");
		},
		onError: () => toast.error("SLO oluşturulamadı"),
	});

	const deleteMut = useMutation({
		mutationFn: sloApi.remove,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["slos"] });
			toast.success("SLO silindi");
		},
	});

	return (
		<PageShell width="wide">
			<PageHeader
				eyebrow="güvenilirlik"
				title="SLO & Hata Bütçesi"
				description="Servis seviyesi hedeflerinizi tanımlayın; hata bütçesi yanma hızını canlı izleyin."
				actions={
					<Button
						size="sm"
						onClick={() =>
							setDraft({
								service_id: services[0]?.id ?? "",
								name: "",
								sli_type: "availability",
								target: 99.9,
								window_days: 30,
							})
						}
						className="h-8 px-3 text-xs text-white"
						style={{ background: "var(--gradient-btn-primary)" }}
						disabled={services.length === 0}
					>
						<Plus className="w-3.5 h-3.5 mr-1.5" /> SLO Ekle
					</Button>
				}
			/>

			{draft && (
				<DraftEditor
					value={draft}
					services={services.map((s) => ({ id: s.id, name: s.name }))}
					onChange={setDraft}
					onCancel={() => setDraft(null)}
					onSubmit={() => createMut.mutate(draft)}
					submitting={createMut.isPending}
				/>
			)}

			<div className="flex flex-col gap-3 mt-4">
				{isLoading ? (
					<div className="space-y-3">
						{[0, 1].map((i) => (
							<div
								key={i}
								className="h-40 rounded-lg animate-pulse"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							/>
						))}
					</div>
				) : slos.length === 0 ? (
					<EmptyState />
				) : (
					slos.map((sl) => (
						<SLOCard
							key={sl.id}
							slo={sl}
							onDelete={() => deleteMut.mutate(sl.id)}
							serviceName={
								services.find((s) => s.id === sl.service_id)?.name ?? "?"
							}
						/>
					))
				)}
			</div>
		</PageShell>
	);
}

function SLOCard({
	slo,
	onDelete,
	serviceName,
}: {
	slo: SLO;
	onDelete: () => void;
	serviceName: string;
}) {
	const { data, isLoading } = useQuery({
		queryKey: ["slo-compliance", slo.id],
		queryFn: () => sloApi.compliance(slo.id),
		refetchInterval: 60_000,
	});

	const meta = SLI_LABELS[slo.sli_type];
	const healthy = data?.healthy ?? true;
	const sli = data?.current_sli ?? 100;
	const used = data?.error_budget_used ?? 0;
	const burn = data?.burn_rate ?? 0;
	const burndown = (data?.burndown ?? []).map((p) => ({
		t: new Date(p.timestamp).toLocaleDateString("tr-TR", {
			day: "2-digit",
			month: "2-digit",
		}),
		remaining: Number(p.budget_remaining.toFixed(2)),
		sli: Number(p.sli.toFixed(2)),
	}));

	return (
		<div
			className="rounded-lg overflow-hidden"
			style={{
				background: "var(--surface-card)",
				border: `1px solid ${healthy ? "var(--border-default)" : "var(--status-down-border)"}`,
			}}
		>
			<div
				className="flex items-center justify-between gap-3 px-4 py-3"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<span
						className="w-8 h-8 rounded flex items-center justify-center shrink-0"
						style={{
							background: healthy
								? "var(--status-up-subtle)"
								: "var(--status-down-subtle)",
							border: `1px solid ${healthy ? "var(--status-up-border)" : "var(--status-down-border)"}`,
						}}
					>
						{healthy ? (
							<CheckCircle2
								className="w-4 h-4"
								style={{ color: "var(--status-up)" }}
							/>
						) : (
							<AlertTriangle
								className="w-4 h-4"
								style={{ color: "var(--status-down)" }}
							/>
						)}
					</span>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<p
								className="text-sm font-bold truncate"
								style={{ color: "var(--text-primary)" }}
							>
								{slo.name}
							</p>
							<span
								className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
								style={{
									color: "var(--color-teal)",
									background: "var(--color-teal-subtle)",
									border: "1px solid var(--color-teal-border)",
								}}
							>
								{meta.label}
							</span>
						</div>
						<p
							className="text-[10px] font-mono mt-0.5"
							style={{ color: "var(--text-muted)" }}
						>
							{serviceName} · hedef{" "}
							<span
								className="tabular-nums font-bold"
								style={{ color: "var(--text-primary)" }}
							>
								{slo.target}%
							</span>{" "}
							· {slo.window_days}g pencere
						</p>
					</div>
				</div>

				<Button
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0"
					onClick={onDelete}
				>
					<Trash2
						className="w-3.5 h-3.5"
						style={{ color: "var(--status-down)" }}
					/>
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
				<div
					className="grid grid-cols-3 gap-3 p-4"
					style={{ borderRight: "1px solid var(--border-subtle)" }}
				>
					<MetricChip
						icon={Target}
						label="SLI"
						value={`${sli.toFixed(2)}%`}
						tone={healthy ? "good" : "bad"}
					/>
					<MetricChip
						icon={Activity}
						label="Bütçe Kullanımı"
						value={`${Math.min(used, 999).toFixed(1)}%`}
						tone={used > 100 ? "bad" : used > 75 ? "warn" : "good"}
					/>
					<MetricChip
						icon={Flame}
						label="Yanma"
						value={`${burn.toFixed(2)}x`}
						tone={burn > 1.5 ? "bad" : burn > 1 ? "warn" : "good"}
					/>
				</div>

				<div className="p-2">
					{isLoading ? (
						<div
							className="h-[160px] rounded animate-pulse"
							style={{ background: "var(--surface-sunken)" }}
						/>
					) : burndown.length === 0 ? (
						<div
							className="h-[160px] flex items-center justify-center text-[11px] font-mono"
							style={{ color: "var(--text-muted)" }}
						>
							Yeterli veri yok.
						</div>
					) : (
						<ResponsiveContainer width="100%" height={160}>
							<AreaChart
								data={burndown}
								margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
							>
								<defs>
									<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1">
										<stop
											offset="0%"
											stopColor="var(--color-teal)"
											stopOpacity={0.3}
										/>
										<stop
											offset="95%"
											stopColor="var(--color-teal)"
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="2 4"
									vertical={false}
									stroke="var(--border-subtle)"
								/>
								<XAxis
									dataKey="t"
									tick={{
										fontSize: 9,
										fontFamily: "IBM Plex Mono, monospace",
										fill: "var(--text-faint)",
									}}
									stroke="var(--border-subtle)"
									tickLine={false}
									axisLine={false}
									interval="preserveStartEnd"
									minTickGap={32}
								/>
								<YAxis
									domain={[0, 100]}
									tick={{
										fontSize: 9,
										fontFamily: "IBM Plex Mono, monospace",
										fill: "var(--text-faint)",
									}}
									stroke="var(--border-subtle)"
									tickLine={false}
									axisLine={false}
									width={30}
								/>
								<Tooltip
									contentStyle={{
										background: "var(--surface-overlay)",
										border: "1px solid var(--border-strong)",
										fontSize: 11,
										fontFamily: "IBM Plex Mono, monospace",
									}}
								/>
								<Area
									type="monotone"
									dataKey="remaining"
									stroke="var(--color-teal)"
									fill="url(#bd)"
									strokeWidth={1.75}
									dot={false}
									name="Bütçe Kalan %"
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</div>
		</div>
	);
}

function MetricChip({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: typeof Clock;
	label: string;
	value: string;
	tone: "good" | "warn" | "bad";
}) {
	const color =
		tone === "bad"
			? "var(--status-down-text)"
			: tone === "warn"
				? "var(--status-warn-text)"
				: "var(--status-up-text)";
	const bg =
		tone === "bad"
			? "var(--status-down-subtle)"
			: tone === "warn"
				? "var(--status-warn-subtle)"
				: "var(--status-up-subtle)";
	return (
		<div
			className="rounded p-2.5 flex flex-col gap-1"
			style={{ background: bg, border: `1px solid ${color}33` }}
		>
			<div
				className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em]"
				style={{ color }}
			>
				<Icon className="w-3 h-3" />
				{label}
			</div>
			<p
				className="text-base font-mono font-bold tabular-nums leading-none"
				style={{ color: "var(--text-primary)" }}
			>
				{value}
			</p>
		</div>
	);
}

function DraftEditor({
	value,
	services,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: CreateSLOInput;
	services: { id: string; name: string }[];
	onChange: (v: CreateSLOInput) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	return (
		<div
			className="mt-4 p-5 rounded-lg flex flex-col gap-4"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-strong)",
			}}
		>
			<p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
				Yeni SLO
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Ad
					</Label>
					<Input
						value={value.name}
						onChange={(e) => onChange({ ...value, name: e.target.value })}
						placeholder="api availability 30d"
						className="mt-1.5 h-9 text-sm"
					/>
				</div>
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Servis
					</Label>
					<select
						value={value.service_id}
						onChange={(e) =>
							onChange({ ...value, service_id: e.target.value })
						}
						className="mt-1.5 w-full h-9 px-2.5 rounded text-sm"
						style={{
							background: "var(--input-bg)",
							border: "1px solid var(--input-border)",
							color: "var(--text-primary)",
						}}
					>
						{services.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						SLI Tipi
					</Label>
					<select
						value={value.sli_type}
						onChange={(e) =>
							onChange({ ...value, sli_type: e.target.value as SLIType })
						}
						className="mt-1.5 w-full h-9 px-2.5 rounded text-sm"
						style={{
							background: "var(--input-bg)",
							border: "1px solid var(--input-border)",
							color: "var(--text-primary)",
						}}
					>
						<option value="availability">availability</option>
						<option value="latency">latency</option>
						<option value="error_rate">error_rate</option>
					</select>
				</div>
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Hedef %
					</Label>
					<Input
						type="number"
						step="0.01"
						min={0.01}
						max={99.99}
						value={value.target}
						onChange={(e) =>
							onChange({ ...value, target: Number(e.target.value) })
						}
						className="mt-1.5 h-9 text-sm font-mono tabular-nums"
					/>
				</div>
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Pencere (gün)
					</Label>
					<Input
						type="number"
						min={1}
						max={90}
						value={value.window_days}
						onChange={(e) =>
							onChange({ ...value, window_days: Number(e.target.value) })
						}
						className="mt-1.5 h-9 text-sm font-mono tabular-nums"
					/>
				</div>
				{value.sli_type !== "availability" && (
					<div>
						<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
							Eşik {value.sli_type === "latency" ? "(ms)" : "(%)"}
						</Label>
						<Input
							type="number"
							value={value.threshold ?? 0}
							onChange={(e) =>
								onChange({ ...value, threshold: Number(e.target.value) })
							}
							className="mt-1.5 h-9 text-sm font-mono tabular-nums"
						/>
					</div>
				)}
			</div>

			<p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
				{SLI_LABELS[value.sli_type].helper}
			</p>

			<div className="flex items-center justify-end gap-2 pt-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 px-3 text-xs"
					onClick={onCancel}
				>
					Vazgeç
				</Button>
				<Button
					size="sm"
					className="h-8 px-3 text-xs text-white"
					style={{ background: "var(--gradient-btn-primary)" }}
					disabled={submitting || !value.name.trim() || !value.service_id}
					onClick={onSubmit}
				>
					{submitting ? (
						<Loader2 className="w-3 h-3 mr-1 animate-spin" />
					) : (
						<Plus className="w-3 h-3 mr-1" />
					)}
					Oluştur
				</Button>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div
			className="flex flex-col items-center justify-center p-12 rounded-lg text-center"
			style={{
				background: "var(--surface-card)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Target className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
			</span>
			<p
				className="text-sm font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				Henüz SLO tanımlı değil
			</p>
			<p
				className="text-xs leading-relaxed max-w-sm"
				style={{ color: "var(--text-muted)" }}
			>
				Bir servis seçip "99.9% availability / 30 gün" gibi bir hedef
				tanımlayarak başla.
			</p>
		</div>
	);
}
