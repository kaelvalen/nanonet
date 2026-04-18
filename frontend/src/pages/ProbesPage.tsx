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
import { Switch } from "@/components/ui/switch";

const KIND_META: Record<"http" | "tcp", { label: string; icon: typeof Globe; help: string }> = {
	http: { label: "HTTP", icon: Globe, help: "https://… veya http://… URL" },
	tcp: { label: "TCP", icon: Plug, help: "host:port (örn. db.example.com:5432)" },
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
		mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateProbeInput> }) =>
			probesApi.update(id, patch),
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
					<div className="flex items-center gap-3 text-[12px] text-white/60">
						<span className="inline-flex items-center gap-1.5">
							<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
							{upCount} up
						</span>
						<span className="inline-flex items-center gap-1.5">
							<XCircle className="h-3.5 w-3.5 text-rose-400" />
							{downCount} down
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Activity className="h-3.5 w-3.5 text-white/40" />
							{items.length} toplam
						</span>
					</div>
				}
				actions={
					<Button
						onClick={() =>
							setDraft({
								name: "",
								kind: "http",
								target: "",
								method: "GET",
								expected_status: 200,
								interval_seconds: 60,
								timeout_seconds: 10,
								enabled: true,
							})
						}
					>
						<Plus className="mr-1 h-4 w-4" />
						Yeni Probe
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
					<div className="flex items-center justify-center py-16 text-white/50">
						<Loader2 className="h-5 w-5 animate-spin" />
					</div>
				) : items.length === 0 && !draft ? (
					<EmptyState onCreate={() => setDraft({
						name: "",
						kind: "http",
						target: "",
						method: "GET",
						expected_status: 200,
						interval_seconds: 60,
						timeout_seconds: 10,
						enabled: true,
					})} />
				) : (
					<div className="flex flex-col gap-2">
						{items.map((p) => (
							<ProbeRow
								key={p.id}
								probe={p}
								onToggle={(enabled) => updateMut.mutate({ id: p.id, patch: { enabled } })}
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
		<div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Icon className="h-3.5 w-3.5 text-white/50" />
						<span className="text-[13px] font-semibold text-white">{probe.name}</span>
						<span
							className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold"
							style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
						>
							{tone.dot}
							{probe.last_status ?? "—"}
						</span>
					</div>
					<div className="mt-1 truncate font-mono text-[11px] text-white/55">{probe.target}</div>
					<div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
						<span>{KIND_META[probe.kind].label}</span>
						<span>her {probe.interval_seconds}s</span>
						<span>timeout {probe.timeout_seconds}s</span>
						{probe.last_latency_ms != null && (
							<span className="font-mono normal-case tabular-nums tracking-normal text-white/55">
								{probe.last_latency_ms}ms
							</span>
						)}
						{probe.last_run_at && (
							<span className="inline-flex items-center gap-1 normal-case tracking-normal text-white/45">
								<Clock className="h-3 w-3" />
								{relative(probe.last_run_at)}
							</span>
						)}
					</div>
					{probe.last_error && probe.last_status !== "up" && (
						<div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 text-[11px] text-rose-200">
							<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono">{probe.last_error}</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-3 shrink-0">
					<Switch
						checked={probe.enabled}
						onCheckedChange={onToggle}
						disabled={busy}
					/>
					<button
						type="button"
						onClick={onDelete}
						disabled={busy}
						className="rounded-md border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
						title="Sil"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
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
		<div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
			<div className="mb-3 flex items-center justify-between">
				<div className="text-[13px] font-semibold text-white">Yeni Probe</div>
				<button type="button" onClick={onCancel} className="text-[11px] text-white/50 hover:text-white">İptal</button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<Label className="text-[11px] text-white/60">Ad</Label>
					<Input
						value={value.name}
						onChange={(e) => onChange({ ...value, name: e.target.value })}
						placeholder="Public API"
					/>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Tür</Label>
					<div className="flex gap-2">
						{(["http", "tcp"] as const).map((k) => (
							<button
								key={k}
								type="button"
								onClick={() => onChange({ ...value, kind: k })}
								className={`flex-1 rounded-md border px-3 py-2 text-[12px] ${value.kind === k ? "border-emerald-400/50 bg-emerald-400/10 text-white" : "border-white/[0.08] text-white/60"}`}
							>
								{KIND_META[k].label}
							</button>
						))}
					</div>
				</div>
				<div className="md:col-span-2">
					<Label className="text-[11px] text-white/60">Hedef</Label>
					<Input
						value={value.target}
						onChange={(e) => onChange({ ...value, target: e.target.value })}
						placeholder={KIND_META[value.kind].help}
					/>
				</div>
				{value.kind === "http" && (
					<>
						<div>
							<Label className="text-[11px] text-white/60">Method</Label>
							<Input
								value={value.method ?? "GET"}
								onChange={(e) => onChange({ ...value, method: e.target.value.toUpperCase() })}
							/>
						</div>
						<div>
							<Label className="text-[11px] text-white/60">Beklenen Status</Label>
							<Input
								type="number"
								value={value.expected_status ?? 200}
								onChange={(e) =>
									onChange({ ...value, expected_status: Number(e.target.value) || 200 })
								}
							/>
						</div>
						<div className="md:col-span-2">
							<Label className="text-[11px] text-white/60">Body içermeli (opsiyonel)</Label>
							<Input
								value={value.body_contains ?? ""}
								onChange={(e) =>
									onChange({ ...value, body_contains: e.target.value || null })
								}
								placeholder='örn. "ok" veya "status":"healthy"'
							/>
						</div>
					</>
				)}
				<div>
					<Label className="text-[11px] text-white/60">Aralık (saniye)</Label>
					<Input
						type="number"
						min={30}
						max={3600}
						value={value.interval_seconds}
						onChange={(e) =>
							onChange({ ...value, interval_seconds: Number(e.target.value) || 60 })
						}
					/>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Timeout (saniye)</Label>
					<Input
						type="number"
						min={1}
						max={60}
						value={value.timeout_seconds}
						onChange={(e) =>
							onChange({ ...value, timeout_seconds: Number(e.target.value) || 10 })
						}
					/>
				</div>
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel} disabled={submitting}>
					İptal
				</Button>
				<Button
					onClick={onSubmit}
					disabled={submitting || !value.name.trim() || !value.target.trim()}
				>
					{submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
					Oluştur
				</Button>
			</div>
		</div>
	);
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
			<Activity className="mx-auto h-8 w-8 text-white/30" />
			<div className="mt-3 text-[14px] font-semibold text-white">Henüz probe yok</div>
			<div className="mt-1 text-[12px] text-white/50">
				Public bir endpoint'i veya 3rd-party API'yi izlemek için bir HTTP/TCP probe ekle.
			</div>
			<Button className="mt-4" onClick={onCreate}>
				<Plus className="mr-1 h-4 w-4" />
				İlk probe'u oluştur
			</Button>
		</div>
	);
}

function statusTone(s: ProbeStatus | null | undefined) {
	switch (s) {
		case "up":
			return {
				bg: "rgba(16, 185, 129, 0.10)",
				fg: "rgb(110, 231, 183)",
				border: "rgba(16, 185, 129, 0.30)",
				dot: <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />,
			};
		case "degraded":
			return {
				bg: "rgba(234, 179, 8, 0.10)",
				fg: "rgb(253, 224, 71)",
				border: "rgba(234, 179, 8, 0.30)",
				dot: <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />,
			};
		case "down":
			return {
				bg: "rgba(244, 63, 94, 0.10)",
				fg: "rgb(253, 164, 175)",
				border: "rgba(244, 63, 94, 0.30)",
				dot: <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />,
			};
		default:
			return {
				bg: "rgba(255,255,255,0.04)",
				fg: "rgba(255,255,255,0.55)",
				border: "rgba(255,255,255,0.10)",
				dot: <span className="h-1.5 w-1.5 rounded-full bg-white/40" />,
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
