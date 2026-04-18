import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BookOpen,
	Loader2,
	Pause,
	Play,
	Plus,
	Trash2,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type CreateRunbookInput,
	type Runbook,
	type RunbookAction,
	type Severity,
	runbooksApi,
} from "@/api/runbooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Switch } from "@/components/ui/switch";
import { useServices } from "@/hooks/useServices";

const ACTIONS: { id: RunbookAction; label: string; help: string }[] = [
	{ id: "restart", label: "Restart", help: "Servisi yeniden başlat" },
	{ id: "stop", label: "Stop", help: "Servisi durdur" },
	{ id: "start", label: "Start", help: "Servisi başlat" },
	{ id: "exec", label: "Exec", help: "args.command çalıştır" },
	{ id: "scale", label: "Scale", help: "args.replicas değişkeni" },
	{ id: "webhook", label: "Webhook", help: "args.url'e POST" },
];

const ALERT_TYPES = [
	"*",
	"high_cpu",
	"high_memory",
	"high_latency",
	"high_error_rate",
	"downtime",
	"probe_down",
];

export function RunbooksPage() {
	const qc = useQueryClient();
	const { data: services } = useServices();
	const [draft, setDraft] = useState<CreateRunbookInput | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["runbooks"],
		queryFn: runbooksApi.list,
		refetchInterval: 30_000,
	});

	const createMut = useMutation({
		mutationFn: runbooksApi.create,
		onSuccess: () => {
			toast.success("Runbook oluşturuldu");
			qc.invalidateQueries({ queryKey: ["runbooks"] });
			setDraft(null);
		},
		onError: () => toast.error("Oluşturma başarısız"),
	});

	const updateMut = useMutation({
		mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateRunbookInput> }) =>
			runbooksApi.update(id, patch),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["runbooks"] });
		},
		onError: () => toast.error("Güncelleme başarısız"),
	});

	const deleteMut = useMutation({
		mutationFn: runbooksApi.remove,
		onSuccess: () => {
			toast.success("Runbook silindi");
			qc.invalidateQueries({ queryKey: ["runbooks"] });
		},
		onError: () => toast.error("Silme başarısız"),
	});

	const items = data ?? [];

	return (
		<PageShell fill>
			<PageHeader
				eyebrow="Automation"
				title="Runbooks"
				description="Alert tetiklendiğinde otomatik aksiyon (restart, exec, webhook) çalıştır."
				meta={
					<div className="flex items-center gap-3 text-[12px] text-white/60">
						<span className="inline-flex items-center gap-1.5">
							<Zap className="h-3.5 w-3.5 text-amber-300" />
							{items.filter((r) => r.enabled).length} aktif
						</span>
						<span className="inline-flex items-center gap-1.5">
							<BookOpen className="h-3.5 w-3.5 text-white/40" />
							{items.length} toplam
						</span>
					</div>
				}
				actions={
					<Button
						onClick={() =>
							setDraft({
								name: "",
								service_id: null,
								alert_type: "high_cpu",
								min_severity: "warn",
								action: "restart",
								args: {},
								enabled: true,
								cooldown_seconds: 600,
								max_per_hour: 6,
							})
						}
					>
						<Plus className="mr-1 h-4 w-4" />
						Yeni Runbook
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto pr-1">
				{draft && (
					<DraftEditor
						value={draft}
						services={(services ?? []).map((s) => ({ id: s.id, name: s.name }))}
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
						service_id: null,
						alert_type: "high_cpu",
						min_severity: "warn",
						action: "restart",
						args: {},
						enabled: true,
						cooldown_seconds: 600,
						max_per_hour: 6,
					})} />
				) : (
					<div className="flex flex-col gap-2">
						{items.map((r) => (
							<RunbookRow
								key={r.id}
								book={r}
								serviceName={
									r.service_id
										? (services ?? []).find((s) => s.id === r.service_id)?.name ?? "—"
										: "Tüm servisler"
								}
								onToggle={(enabled) => updateMut.mutate({ id: r.id, patch: { enabled } })}
								onDelete={() => deleteMut.mutate(r.id)}
								busy={
									(updateMut.isPending && updateMut.variables?.id === r.id) ||
									(deleteMut.isPending && deleteMut.variables === r.id)
								}
							/>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}

function RunbookRow({
	book,
	serviceName,
	onToggle,
	onDelete,
	busy,
}: {
	book: Runbook;
	serviceName: string;
	onToggle: (enabled: boolean) => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const sev = severityTone(book.min_severity);
	return (
		<div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-[13px] font-semibold text-white">{book.name}</span>
						<span
							className="rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold"
							style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.border}` }}
						>
							≥ {book.min_severity}
						</span>
						<span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold text-white/70">
							{book.action}
						</span>
					</div>
					<div className="mt-1 text-[12px] text-white/55">
						<span className="font-mono">{book.alert_type}</span>
						<span className="mx-2 text-white/30">→</span>
						<span>{serviceName}</span>
					</div>
					<div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
						<span>cooldown {book.cooldown_seconds}s</span>
						<span>≤ {book.max_per_hour}/sa</span>
						<span className="font-mono normal-case tracking-normal text-white/55">{book.fire_count} kez tetiklendi</span>
						{book.last_fired_at && (
							<span className="normal-case tracking-normal text-white/45">son: {relative(book.last_fired_at)}</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0">
					<Switch checked={book.enabled} onCheckedChange={onToggle} disabled={busy} />
					<button
						type="button"
						onClick={onDelete}
						disabled={busy}
						className="rounded-md border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
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
	services,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: CreateRunbookInput;
	services: { id: string; name: string }[];
	onChange: (v: CreateRunbookInput) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	const argsJson = JSON.stringify(value.args ?? {}, null, 2);
	return (
		<div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
			<div className="mb-3 flex items-center justify-between">
				<div className="text-[13px] font-semibold text-white">Yeni Runbook</div>
				<button type="button" onClick={onCancel} className="text-[11px] text-white/50 hover:text-white">İptal</button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<Label className="text-[11px] text-white/60">Ad</Label>
					<Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Auto-restart on CPU spike" />
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Servis</Label>
					<select
						className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-white"
						value={value.service_id ?? ""}
						onChange={(e) => onChange({ ...value, service_id: e.target.value || null })}
					>
						<option value="">Tüm servisler</option>
						{services.map((s) => (
							<option key={s.id} value={s.id}>{s.name}</option>
						))}
					</select>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Alert Tipi</Label>
					<select
						className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-white"
						value={value.alert_type}
						onChange={(e) => onChange({ ...value, alert_type: e.target.value })}
					>
						{ALERT_TYPES.map((t) => (
							<option key={t} value={t}>{t}</option>
						))}
					</select>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Minimum Severity</Label>
					<div className="flex gap-2">
						{(["info", "warn", "crit"] as Severity[]).map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => onChange({ ...value, min_severity: s })}
								className={`flex-1 rounded-md border px-3 py-2 text-[12px] uppercase tracking-[0.15em] ${value.min_severity === s ? "border-emerald-400/50 bg-emerald-400/10 text-white" : "border-white/[0.08] text-white/60"}`}
							>
								{s}
							</button>
						))}
					</div>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Aksiyon</Label>
					<select
						className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-white"
						value={value.action}
						onChange={(e) => onChange({ ...value, action: e.target.value as RunbookAction })}
					>
						{ACTIONS.map((a) => (
							<option key={a.id} value={a.id}>{a.label} — {a.help}</option>
						))}
					</select>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Aktif</Label>
					<div className="flex h-9 items-center">
						<Switch
							checked={value.enabled !== false}
							onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
						/>
					</div>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Cooldown (s)</Label>
					<Input
						type="number"
						min={0}
						value={value.cooldown_seconds}
						onChange={(e) => onChange({ ...value, cooldown_seconds: Number(e.target.value) || 0 })}
					/>
				</div>
				<div>
					<Label className="text-[11px] text-white/60">Saat başına maksimum</Label>
					<Input
						type="number"
						min={1}
						max={60}
						value={value.max_per_hour}
						onChange={(e) => onChange({ ...value, max_per_hour: Number(e.target.value) || 6 })}
					/>
				</div>
				<div className="md:col-span-2">
					<Label className="text-[11px] text-white/60">Args (JSON)</Label>
					<textarea
						className="min-h-[80px] w-full rounded-md border border-white/[0.08] bg-white/[0.02] p-2 font-mono text-[12px] text-white"
						value={argsJson}
						onChange={(e) => {
							try {
								const parsed = JSON.parse(e.target.value || "{}");
								onChange({ ...value, args: parsed });
							} catch {
								// ignore until valid
							}
						}}
					/>
					<div className="mt-1 text-[10px] text-white/40">
						exec için <span className="font-mono">{`{"command":"systemctl restart svc"}`}</span>, scale için <span className="font-mono">{`{"replicas":3}`}</span>, webhook için <span className="font-mono">{`{"url":"https://..."}`}</span>
					</div>
				</div>
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel} disabled={submitting}>İptal</Button>
				<Button
					onClick={onSubmit}
					disabled={submitting || !value.name.trim()}
				>
					{submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
					Oluştur
				</Button>
			</div>
		</div>
	);
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
			<Pause className="mx-auto h-8 w-8 text-white/30" />
			<div className="mt-3 text-[14px] font-semibold text-white">Henüz runbook yok</div>
			<div className="mt-1 text-[12px] text-white/50">
				Tekrarlayan müdahaleleri otomatikleştir: alert tetiklendiğinde restart/exec/webhook çalıştır.
			</div>
			<Button className="mt-4" onClick={onCreate}>
				<Plus className="mr-1 h-4 w-4" />
				İlk runbook'u oluştur
			</Button>
		</div>
	);
}

function severityTone(s: Severity) {
	switch (s) {
		case "crit":
			return { bg: "rgba(244,63,94,0.10)", fg: "rgb(253,164,175)", border: "rgba(244,63,94,0.30)" };
		case "warn":
			return { bg: "rgba(234,179,8,0.10)", fg: "rgb(253,224,71)", border: "rgba(234,179,8,0.30)" };
		default:
			return { bg: "rgba(59,130,246,0.10)", fg: "rgb(147,197,253)", border: "rgba(59,130,246,0.30)" };
	}
}

function relative(iso: string): string {
	const t = new Date(iso).getTime();
	const diff = Math.max(0, Date.now() - t);
	const s = Math.floor(diff / 1000);
	if (s < 60) return `${s}s önce`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}d önce`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}sa önce`;
	return `${Math.floor(h / 24)}g önce`;
}
