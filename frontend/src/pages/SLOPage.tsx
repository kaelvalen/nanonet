import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Flame,
	Loader2,
	type LucideIcon,
	Pencil,
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
import { type CreateSLOInput, type SLIType, type SLO, sloApi } from "@/api/slo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	EmptyState as SharedEmptyState,
	SkeletonList,
} from "@/components/ui/primitives";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
		label: "Hata oranı",
		helper: "eşik altındaki hata oranlı örneklerin toplam içindeki oranı",
	},
};

/* Same dual-mode draft pattern as Probes/Runbooks: __editingId !== undefined
   means we're editing a server SLO; otherwise we're creating a new one. */
type Draft = CreateSLOInput & { __editingId?: string };

export function SLOPage() {
	const qc = useQueryClient();
	const { services } = useServices();
	const [draft, setDraft] = useState<Draft | null>(null);

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

	const updateMut = useMutation({
		mutationFn: ({
			id,
			patch,
		}: {
			id: string;
			patch: Partial<CreateSLOInput>;
		}) => sloApi.update(id, patch),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["slos"] });
			setDraft(null);
			toast.success("SLO güncellendi");
		},
		onError: () => toast.error("Güncelleme başarısız"),
	});

	const deleteMut = useMutation({
		mutationFn: sloApi.remove,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["slos"] });
			toast.success("SLO silindi");
		},
	});

	return (
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="güvenilirlik"
				title="SLO & hata bütçesi"
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
						disabled={services.length === 0}
					>
						<Plus className="w-3.5 h-3.5 mr-1.5" />
						SLO ekle
					</Button>
				}
			/>

			{draft && (
				<DraftEditor
					value={draft}
					editing={Boolean(draft.__editingId)}
					services={services.map((s) => ({ id: s.id, name: s.name }))}
					onChange={setDraft}
					onCancel={() => setDraft(null)}
					onSubmit={() => {
						if (draft.__editingId) {
							const { __editingId, ...patch } = draft;
							updateMut.mutate({ id: __editingId, patch });
						} else {
							createMut.mutate(draft);
						}
					}}
					submitting={createMut.isPending || updateMut.isPending}
				/>
			)}

			<div className="flex flex-col gap-3 mt-4">
				{isLoading ? (
					<SkeletonList rows={2} rowHeight={160} />
				) : slos.length === 0 ? (
					<SharedEmptyState
						icon={Target}
						title="Henüz SLO tanımlı değil"
						description='Bir servis seçip "99.9% availability / 30 gün" gibi bir hedef tanımlayarak başlayın.'
						tone="accent"
						size="lg"
					/>
				) : (
					slos.map((sl) => (
						<SLOCard
							key={sl.id}
							slo={sl}
							editing={draft?.__editingId === sl.id}
							onEdit={() =>
								setDraft({
									__editingId: sl.id,
									service_id: sl.service_id,
									name: sl.name,
									sli_type: sl.sli_type,
									threshold: sl.threshold ?? null,
									target: sl.target,
									window_days: sl.window_days,
								})
							}
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
	editing,
	onEdit,
	onDelete,
	serviceName,
}: {
	slo: SLO;
	editing: boolean;
	onEdit: () => void;
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
	const accent = healthy ? "var(--status-up)" : "var(--status-down)";
	const burndown = (data?.burndown ?? []).map((p) => ({
		t: new Date(p.timestamp).toLocaleDateString("tr-TR", {
			day: "2-digit",
			month: "2-digit",
		}),
		remaining: Number(p.budget_remaining.toFixed(2)),
		sli: Number(p.sli.toFixed(2)),
	}));

	return (
		<Panel
			padding="none"
			className="overflow-hidden relative transition-colors"
			style={
				editing
					? {
							background: "var(--surface-sunken)",
							borderColor: "var(--border-strong)",
						}
					: undefined
			}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3.5 bottom-3.5 w-[2px] rounded-r-full"
				style={{ background: accent }}
			/>
			<div
				className="flex items-center justify-between gap-3 px-4 py-3 pl-5"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-3 min-w-0">
					<span
						className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
						style={{
							background: healthy
								? "var(--status-up-subtle)"
								: "var(--status-down-subtle)",
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
						<div className="flex items-center gap-2 flex-wrap">
							<p
								className="text-[14px] font-semibold truncate"
								style={{ color: "var(--text-primary)" }}
							>
								{slo.name}
							</p>
							<span
								className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] shrink-0"
								style={{
									color: "var(--brand-primary)",
									background: "var(--brand-primary-subtle)",
								}}
							>
								{meta.label}
							</span>
						</div>
						<p
							className="text-[12px] mt-1"
							style={{ color: "var(--text-tertiary)" }}
						>
							{serviceName} · hedef{" "}
							<span
								className="tnum font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								{slo.target}%
							</span>{" "}
							· {slo.window_days}g pencere
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					<Button
						size="icon"
						variant="ghost"
						onClick={onEdit}
						aria-label="SLO düzenle"
					>
						<Pencil
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-tertiary)" }}
						/>
					</Button>
					<Button
						size="icon"
						variant="ghost"
						onClick={onDelete}
						aria-label="SLO sil"
					>
						<Trash2
							className="w-3.5 h-3.5"
							style={{ color: "var(--status-down)" }}
						/>
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[minmax(260px,300px)_1fr] gap-0">
				<div
					className="grid grid-cols-3 gap-2 p-3"
					style={{ borderRight: "1px solid var(--border-subtle)" }}
				>
					<MetricChip
						icon={Target}
						label="SLI"
						value={formatPercent(sli)}
						unit="%"
						tone={healthy ? "good" : "bad"}
					/>
					<MetricChip
						icon={Activity}
						label="Bütçe"
						value={formatBudget(used)}
						unit={used > 999 ? "%+" : "%"}
						tone={used > 100 ? "bad" : used > 75 ? "warn" : "good"}
					/>
					<MetricChip
						icon={Flame}
						label="Yanma"
						value={formatBurn(burn)}
						unit="×"
						tone={burn > 1.5 ? "bad" : burn > 1 ? "warn" : "good"}
					/>
				</div>

				<div className="p-2">
					{isLoading ? (
						<div
							className="h-[160px] rounded-[6px] animate-pulse"
							style={{ background: "var(--surface-sunken)" }}
						/>
					) : burndown.length === 0 ? (
						<div
							className="h-[160px] flex items-center justify-center text-[11px] font-mono"
							style={{ color: "var(--text-tertiary)" }}
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
											stopColor="var(--brand-primary)"
											stopOpacity={0.22}
										/>
										<stop
											offset="95%"
											stopColor="var(--brand-primary)"
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
										fontSize: 10,
										fontFamily: "var(--font-mono)",
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
										fontSize: 10,
										fontFamily: "var(--font-mono)",
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
										border: "1px solid var(--border-default)",
										borderRadius: 6,
										fontSize: 11,
										fontFamily: "var(--font-mono)",
									}}
								/>
								<Area
									type="monotone"
									dataKey="remaining"
									stroke="var(--brand-primary)"
									fill="url(#bd)"
									strokeWidth={1.5}
									dot={false}
									name="Bütçe kalan %"
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</div>
		</Panel>
	);
}

/* Smart formatters — precision should track magnitude. A budget of 999%+
   doesn't need a `.0` decimal (it's a saturation marker); a 504× burn rate
   doesn't need 2 decimals either (the magnitude is the headline, not the
   sub-percent). Keeping high precision on big numbers reads as fake-precise
   and visually busy. */

function formatPercent(value: number): string {
	if (value >= 99.95) return "100";
	if (value >= 10) return value.toFixed(1);
	return value.toFixed(2);
}

function formatBudget(used: number): string {
	if (used > 999) return "999";
	if (used >= 100) return Math.round(used).toString();
	if (used >= 10) return used.toFixed(1);
	return used.toFixed(2);
}

function formatBurn(burn: number): string {
	if (burn >= 100) return Math.round(burn).toString();
	if (burn >= 10) return burn.toFixed(1);
	return burn.toFixed(2);
}

function MetricChip({
	icon: Icon,
	label,
	value,
	unit,
	tone,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	unit: string;
	tone: "good" | "warn" | "bad";
}) {
	/* Tone is carried entirely by the icon color — a single, small signal.
	   The number itself stays in --text-primary so big/bad numbers don't
	   shout twice (icon red + value red). The parent SLOCard's left accent
	   already conveys overall health for the whole row. Quiet Swiss = one
	   accent per scope, and within a scope, one tonal cue per fact.

	   The unit is rendered as a smaller, lighter sibling so the number
	   itself dominates and the column of values across chips aligns by
	   digit, not by glyph width. */
	const iconTint =
		tone === "bad"
			? "var(--status-down)"
			: tone === "warn"
				? "var(--status-degraded)"
				: "var(--text-faint)";
	return (
		<div
			className="rounded-[6px] px-3 py-2.5 flex flex-col gap-1.5"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div
				className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider"
				style={{ color: "var(--text-faint)" }}
			>
				<Icon className="w-3 h-3" style={{ color: iconTint }} />
				{label}
			</div>
			<p
				className="flex items-baseline gap-0.5 leading-none"
				style={{ color: "var(--text-primary)" }}
			>
				<span className="text-[20px] font-semibold tnum tracking-tight">
					{value}
				</span>
				<span
					className="text-[11px] font-medium"
					style={{ color: "var(--text-faint)" }}
				>
					{unit}
				</span>
			</p>
		</div>
	);
}

function DraftEditor({
	value,
	editing,
	services,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: Draft;
	editing: boolean;
	services: { id: string; name: string }[];
	onChange: (v: Draft) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	return (
		<Panel className="mt-4" padding="none">
			<PanelHeader dense>{editing ? "SLO düzenle" : "Yeni SLO"}</PanelHeader>
			<PanelBody scroll={false} className="flex flex-col gap-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<Label
							htmlFor="slo-name"
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Ad
						</Label>
						<Input
							id="slo-name"
							value={value.name}
							onChange={(e) => onChange({ ...value, name: e.target.value })}
							placeholder="api availability 30d"
							className="mt-1.5 h-9 text-[13px]"
						/>
					</div>
					<div>
						<Label
							htmlFor="slo-service"
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Servis
						</Label>
						<Select
							value={value.service_id}
							onValueChange={(v) => onChange({ ...value, service_id: v })}
						>
							<SelectTrigger
								id="slo-service"
								className="mt-1.5 h-9 text-[13px]"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{services.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div>
						<Label
							htmlFor="slo-sli"
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							SLI tipi
						</Label>
						<Select
							value={value.sli_type}
							onValueChange={(v) =>
								onChange({ ...value, sli_type: v as SLIType })
							}
						>
							<SelectTrigger id="slo-sli" className="mt-1.5 h-9 text-[13px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="availability">availability</SelectItem>
								<SelectItem value="latency">latency</SelectItem>
								<SelectItem value="error_rate">error_rate</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label
							htmlFor="slo-target"
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Hedef %
						</Label>
						<Input
							id="slo-target"
							type="number"
							step="0.01"
							min={0.01}
							max={99.99}
							value={value.target}
							onChange={(e) =>
								onChange({ ...value, target: Number(e.target.value) })
							}
							className="mt-1.5 h-9 text-[13px] font-mono tnum"
						/>
					</div>
					<div>
						<Label
							htmlFor="slo-window"
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Pencere (gün)
						</Label>
						<Input
							id="slo-window"
							type="number"
							min={1}
							max={90}
							value={value.window_days}
							onChange={(e) =>
								onChange({ ...value, window_days: Number(e.target.value) })
							}
							className="mt-1.5 h-9 text-[13px] font-mono tnum"
						/>
					</div>
					{value.sli_type !== "availability" && (
						<div>
							<Label
								htmlFor="slo-threshold"
								className="text-[11px] font-medium uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								Eşik {value.sli_type === "latency" ? "(ms)" : "(%)"}
							</Label>
							<Input
								id="slo-threshold"
								type="number"
								value={value.threshold ?? 0}
								onChange={(e) =>
									onChange({ ...value, threshold: Number(e.target.value) })
								}
								className="mt-1.5 h-9 text-[13px] font-mono tnum"
							/>
						</div>
					)}
				</div>

				<p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
					{SLI_LABELS[value.sli_type].helper}
				</p>
			</PanelBody>
			<PanelFooter>
				<Button variant="outline" size="sm" onClick={onCancel}>
					Vazgeç
				</Button>
				<Button
					size="sm"
					disabled={submitting || !value.name.trim() || !value.service_id}
					onClick={onSubmit}
				>
					{submitting ? (
						<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
					) : editing ? (
						<Pencil className="w-3.5 h-3.5 mr-1.5" />
					) : (
						<Plus className="w-3.5 h-3.5 mr-1.5" />
					)}
					{editing ? "Kaydet" : "Oluştur"}
				</Button>
			</PanelFooter>
		</Panel>
	);
}
