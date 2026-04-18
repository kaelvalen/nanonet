import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Clock,
	Globe,
	Loader2,
	Plug,
	Plus,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type CreateProbeInput,
	type Probe,
	type ProbeStatus,
	probesApi,
} from "@/api/probes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	SkeletonList,
} from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";

const KIND_META: Record<
	"http" | "tcp",
	{ label: string; icon: typeof Globe; help: string }
> = {
	http: { label: "HTTP", icon: Globe, help: "https://… veya http://… URL" },
	tcp: {
		label: "TCP",
		icon: Plug,
		help: "host:port (örn. db.example.com:5432)",
	},
};

const DEFAULT_DRAFT: CreateProbeInput = {
	name: "",
	kind: "http",
	target: "",
	method: "GET",
	expected_status: 200,
	interval_seconds: 60,
	timeout_seconds: 10,
	enabled: true,
};

export function ProbesPage() {
	const qc = useQueryClient();
	const [draft, setDraft] = useState<CreateProbeInput | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["probes"],
		queryFn: probesApi.list,
		refetchInterval: 15_000,
	});

	const createMut = useMutation({
		mutationFn: probesApi.create,
		onSuccess: () => {
			toast.success("Probe oluşturuldu");
			qc.invalidateQueries({ queryKey: ["probes"] });
			setDraft(null);
		},
		onError: () => toast.error("Probe oluşturulamadı"),
	});

	const updateMut = useMutation({
		mutationFn: ({
			id,
			patch,
		}: {
			id: string;
			patch: Partial<CreateProbeInput>;
		}) => probesApi.update(id, patch),
		onSuccess: () => {
			toast.success("Probe güncellendi");
			qc.invalidateQueries({ queryKey: ["probes"] });
		},
		onError: () => toast.error("Güncelleme başarısız"),
	});

	const deleteMut = useMutation({
		mutationFn: probesApi.remove,
		onSuccess: () => {
			toast.success("Probe silindi");
			qc.invalidateQueries({ queryKey: ["probes"] });
		},
		onError: () => toast.error("Silme başarısız"),
	});

	const items = data ?? [];
	const upCount = items.filter((p) => p.last_status === "up").length;
	const downCount = items.filter((p) => p.last_status === "down").length;

	return (
		<PageShell fill>
			<PageHeader
				eyebrow="Synthetic"
				title="Probes"
				description="Sunucu tarafından yürütülen HTTP/TCP sağlık denetimleri."
				meta={
					<div
						className="flex items-center gap-3 text-[12px]"
						style={{ color: "var(--text-muted)" }}
					>
						<span className="inline-flex items-center gap-1.5">
							<CheckCircle2
								className="h-3.5 w-3.5"
								style={{ color: "var(--status-up)" }}
							/>
							{upCount} up
						</span>
						<span className="inline-flex items-center gap-1.5">
							<XCircle
								className="h-3.5 w-3.5"
								style={{ color: "var(--status-down)" }}
							/>
							{downCount} down
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Activity
								className="h-3.5 w-3.5"
								style={{ color: "var(--text-faint)" }}
							/>
							{items.length} toplam
						</span>
					</div>
				}
				actions={
					<Button
						size="sm"
						onClick={() => setDraft(DEFAULT_DRAFT)}
						className="h-9 px-4 text-[13px] text-white rounded-full"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						<Plus className="mr-1.5 h-3.5 w-3.5" />
						Yeni Probe
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
				{draft && (
					<DraftEditor
						value={draft}
						onChange={setDraft}
						onCancel={() => setDraft(null)}
						onSubmit={() => createMut.mutate(draft)}
						submitting={createMut.isPending}
					/>
				)}

				{isLoading ? (
					<SkeletonList rows={4} rowHeight={88} />
				) : items.length === 0 && !draft ? (
					<SharedEmptyState
						icon={Activity}
						title="Henüz probe yok"
						description="Public bir endpoint'i veya 3rd-party API'yi izlemek için bir HTTP/TCP probe ekle."
						tone="accent"
						size="lg"
						action={
							<Button
								className="text-white"
								size="sm"
								style={{ background: "var(--gradient-btn-primary)" }}
								onClick={() => setDraft(DEFAULT_DRAFT)}
							>
								<Plus className="mr-1 h-4 w-4" />
								İlk probe'u oluştur
							</Button>
						}
					/>
				) : (
					<div className="flex flex-col gap-2 mt-2">
						{items.map((p) => (
							<ProbeRow
								key={p.id}
								probe={p}
								onToggle={(enabled) =>
									updateMut.mutate({ id: p.id, patch: { enabled } })
								}
								onDelete={() => deleteMut.mutate(p.id)}
								busy={
									(updateMut.isPending && updateMut.variables?.id === p.id) ||
									(deleteMut.isPending && deleteMut.variables === p.id)
								}
							/>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}

function ProbeRow({
	probe,
	onToggle,
	onDelete,
	busy,
}: {
	probe: Probe;
	onToggle: (enabled: boolean) => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const tone = statusTone(probe.last_status);
	const Icon = KIND_META[probe.kind].icon;
	return (
		<Panel padding="md" className="rounded-2xl">
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2.5 flex-wrap">
						<span
							className="w-9 h-9 rounded-xl flex items-center justify-center"
							style={{ background: "var(--surface-sunken)" }}
						>
							<Icon
								className="h-4 w-4"
								style={{ color: "var(--text-muted)" }}
							/>
						</span>
						<span
							className="text-[14px] font-semibold tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							{probe.name}
						</span>
						<span
							className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
							style={{
								background: tone.bg,
								color: tone.fg,
							}}
						>
							<span
								className="h-1.5 w-1.5 rounded-full"
								style={{ background: tone.dot }}
							/>
							{probe.last_status ?? "—"}
						</span>
					</div>
					<div
						className="mt-2 truncate font-mono text-[12px]"
						style={{ color: "var(--text-muted)" }}
					>
						{probe.target}
					</div>
					<div
						className="mt-2 flex items-center gap-3 flex-wrap text-[12px]"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="font-medium">{KIND_META[probe.kind].label}</span>
						<span>her {probe.interval_seconds}s</span>
						<span>timeout {probe.timeout_seconds}s</span>
						{probe.last_latency_ms != null && (
							<span
								className="font-mono tabular-nums"
								style={{ color: "var(--text-muted)" }}
							>
								{probe.last_latency_ms}ms
							</span>
						)}
						{probe.last_run_at && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--text-muted)" }}
							>
								<Clock className="h-3 w-3" />
								{relative(probe.last_run_at)}
							</span>
						)}
					</div>
					{probe.last_error && probe.last_status !== "up" && (
						<div
							className="mt-2.5 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12px]"
							style={{
								background: "var(--status-down-subtle)",
								color: "var(--status-down-text)",
							}}
						>
							<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							<span className="font-mono break-all">{probe.last_error}</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
					<Switch
						checked={probe.enabled}
						onCheckedChange={onToggle}
						disabled={busy}
					/>
					<button
						type="button"
						onClick={onDelete}
						disabled={busy}
						className="rounded-full h-8 w-8 flex items-center justify-center disabled:opacity-50 transition-colors"
						style={{
							background: "var(--status-down-subtle)",
							color: "var(--status-down-text)",
						}}
						title="Sil"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</Panel>
	);
}

function DraftEditor({
	value,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: CreateProbeInput;
	onChange: (v: CreateProbeInput) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	return (
		<Panel className="mb-3">
			<PanelHeader
				dense
				actions={
					<button
						type="button"
						onClick={onCancel}
						className="text-[11px]"
						style={{ color: "var(--text-muted)" }}
					>
						İptal
					</button>
				}
			>
				Yeni Probe
			</PanelHeader>
			<PanelBody scroll={false}>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Ad
					</Label>
					<Input
						value={value.name}
						onChange={(e) => onChange({ ...value, name: e.target.value })}
						placeholder="Public API"
						className="mt-1.5 h-9 text-[13px] rounded-lg"
					/>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Tür
					</Label>
					<div className="flex gap-1.5 mt-2">
						{(["http", "tcp"] as const).map((k) => {
							const active = value.kind === k;
							return (
								<button
									key={k}
									type="button"
									onClick={() => onChange({ ...value, kind: k })}
									className="flex-1 rounded-xl px-3 h-10 text-[13px] font-medium transition-all"
									style={{
										background: active
											? "var(--color-teal-subtle)"
											: "var(--surface-sunken)",
										border: `1px solid ${active ? "var(--color-teal-border)" : "transparent"}`,
										color: active ? "var(--color-teal)" : "var(--text-muted)",
									}}
								>
									{KIND_META[k].label}
								</button>
							);
						})}
					</div>
				</div>
				<div className="md:col-span-2">
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Hedef
					</Label>
					<Input
						value={value.target}
						onChange={(e) => onChange({ ...value, target: e.target.value })}
						placeholder={KIND_META[value.kind].help}
						className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
					/>
				</div>
				{value.kind === "http" && (
					<>
						<div>
							<Label
								className="text-[12px] font-medium"
								style={{ color: "var(--text-faint)" }}
							>
								Method
							</Label>
							<Input
								value={value.method ?? "GET"}
								onChange={(e) =>
									onChange({
										...value,
										method: e.target.value.toUpperCase(),
									})
								}
								className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
							/>
						</div>
						<div>
							<Label
								className="text-[12px] font-medium"
								style={{ color: "var(--text-faint)" }}
							>
								Beklenen Status
							</Label>
							<Input
								type="number"
								value={value.expected_status ?? 200}
								onChange={(e) =>
									onChange({
										...value,
										expected_status: Number(e.target.value) || 200,
									})
								}
								className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
							/>
						</div>
						<div className="md:col-span-2">
							<Label
								className="text-[12px] font-medium"
								style={{ color: "var(--text-faint)" }}
							>
								Body içermeli (opsiyonel)
							</Label>
							<Input
								value={value.body_contains ?? ""}
								onChange={(e) =>
									onChange({
										...value,
										body_contains: e.target.value || null,
									})
								}
								placeholder='örn. "ok" veya "status":"healthy"'
								className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
							/>
						</div>
					</>
				)}
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Aralık (saniye)
					</Label>
					<Input
						type="number"
						min={30}
						max={3600}
						value={value.interval_seconds}
						onChange={(e) =>
							onChange({
								...value,
								interval_seconds: Number(e.target.value) || 60,
							})
						}
						className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
					/>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Timeout (saniye)
					</Label>
					<Input
						type="number"
						min={1}
						max={60}
						value={value.timeout_seconds}
						onChange={(e) =>
							onChange({
								...value,
								timeout_seconds: Number(e.target.value) || 10,
							})
						}
						className="mt-1.5 h-9 text-[13px] font-mono rounded-lg"
					/>
				</div>
			</div>
			</PanelBody>
			<PanelFooter>
				<Button
					variant="outline"
					size="sm"
					className="h-9 px-4 text-[13px] rounded-full"
					onClick={onCancel}
					disabled={submitting}
				>
					İptal
				</Button>
				<Button
					size="sm"
					className="h-9 px-4 text-[13px] text-white rounded-full"
					style={{ background: "var(--gradient-btn-primary)" }}
					onClick={onSubmit}
					disabled={
						submitting || !value.name.trim() || !value.target.trim()
					}
				>
					{submitting ? (
						<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
					) : (
						<Plus className="mr-1.5 h-3.5 w-3.5" />
					)}
					Oluştur
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function statusTone(s: ProbeStatus | null | undefined) {
	switch (s) {
		case "up":
			return {
				bg: "var(--status-up-subtle)",
				fg: "var(--status-up-text)",
				border: "var(--status-up-border)",
				dot: "var(--status-up)",
			};
		case "degraded":
			return {
				bg: "var(--status-degraded-subtle)",
				fg: "var(--status-degraded-text)",
				border: "var(--status-degraded-border)",
				dot: "var(--status-degraded)",
			};
		case "down":
			return {
				bg: "var(--status-down-subtle)",
				fg: "var(--status-down-text)",
				border: "var(--status-down-border)",
				dot: "var(--status-down)",
			};
		default:
			return {
				bg: "var(--surface-sunken)",
				fg: "var(--text-muted)",
				border: "var(--border-default)",
				dot: "var(--text-faint)",
			};
	}
}

function relative(iso: string): string {
	const t = new Date(iso).getTime();
	const diff = Math.max(0, Date.now() - t);
	const s = Math.floor(diff / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}d`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}sa`;
	return `${Math.floor(h / 24)}g`;
}
