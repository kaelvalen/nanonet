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
import {
	EmptyState as SharedEmptyState,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	SkeletonList,
} from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const DEFAULT_DRAFT: CreateRunbookInput = {
	name: "",
	service_id: null,
	alert_type: "high_cpu",
	min_severity: "warn",
	action: "restart",
	args: {},
	enabled: true,
	cooldown_seconds: 600,
	max_per_hour: 6,
};

export function RunbooksPage() {
	const qc = useQueryClient();
	const { services } = useServices();
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
		mutationFn: ({
			id,
			patch,
		}: {
			id: string;
			patch: Partial<CreateRunbookInput>;
		}) => runbooksApi.update(id, patch),
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
	const activeCount = items.filter((r) => r.enabled).length;

	return (
		<PageShell fill>
			<PageHeader
				eyebrow="Automation"
				title="Runbooks"
				description="Alert tetiklendiğinde otomatik aksiyon (restart, exec, webhook) çalıştır."
				meta={
					<div
						className="flex items-center gap-3 text-[12px]"
						style={{ color: "var(--text-muted)" }}
					>
						<span className="inline-flex items-center gap-1.5">
							<Zap
								className="h-3.5 w-3.5"
								style={{ color: "var(--color-amber)" }}
							/>
							{activeCount} aktif
						</span>
						<span className="inline-flex items-center gap-1.5">
							<BookOpen
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
						Yeni Runbook
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
				{draft && (
					<DraftEditor
						value={draft}
						services={services.map((s) => ({
							id: s.id,
							name: s.name,
						}))}
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
						icon={Pause}
						title="Henüz runbook yok"
						description="Tekrarlayan müdahaleleri otomatikleştir: alert tetiklendiğinde restart/exec/webhook çalıştır."
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
								İlk runbook'u oluştur
							</Button>
						}
					/>
				) : (
					<div className="flex flex-col gap-2 mt-2">
						{items.map((r) => (
							<RunbookRow
								key={r.id}
								book={r}
								serviceName={
									r.service_id
										? (services.find((s) => s.id === r.service_id)?.name ??
											"—")
										: "Tüm servisler"
								}
								onToggle={(enabled) =>
									updateMut.mutate({ id: r.id, patch: { enabled } })
								}
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
		<Panel padding="md" className="rounded-2xl" style={{ opacity: book.enabled ? 1 : 0.65 }}>
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className="text-[14px] font-semibold tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							{book.name}
						</span>
						<span
							className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
							style={{
								background: sev.bg,
								color: sev.fg,
							}}
						>
							≥ {book.min_severity}
						</span>
						<span
							className="rounded-full px-2 py-0.5 text-[11px] font-medium"
							style={{
								background: "var(--surface-sunken)",
								color: "var(--text-secondary)",
							}}
						>
							{book.action}
						</span>
					</div>
					<div
						className="mt-2 text-[12px]"
						style={{ color: "var(--text-muted)" }}
					>
						<span className="font-mono">{book.alert_type}</span>
						<span
							className="mx-2"
							style={{ color: "var(--text-faint)" }}
						>
							→
						</span>
						<span>{serviceName}</span>
					</div>
					<div
						className="mt-2 flex items-center gap-3 flex-wrap text-[12px]"
						style={{ color: "var(--text-faint)" }}
					>
						<span>cooldown {book.cooldown_seconds}s</span>
						<span>≤ {book.max_per_hour}/sa</span>
						<span
							className="font-mono tabular-nums"
							style={{ color: "var(--text-muted)" }}
						>
							{book.fire_count} kez tetiklendi
						</span>
						{book.last_fired_at && (
							<span style={{ color: "var(--text-muted)" }}>
								son: {relative(book.last_fired_at)}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
					<Switch
						checked={book.enabled}
						onCheckedChange={onToggle}
						disabled={busy}
					/>
					<button
						type="button"
						onClick={onDelete}
						disabled={busy}
						className="rounded-full h-8 w-8 flex items-center justify-center disabled:opacity-50 transition-colors"
						style={{
							color: "var(--status-down-text)",
							background: "var(--status-down-subtle)",
						}}
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
				Yeni Runbook
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
						placeholder="Auto-restart on CPU spike"
						className="mt-1.5 h-9 text-[13px] rounded-lg"
					/>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Servis
					</Label>
					<select
						className="mt-1.5 h-9 w-full rounded-lg px-3 text-[13px]"
						style={{
							background: "var(--input-bg)",
							border: "1px solid var(--input-border)",
							color: "var(--text-primary)",
						}}
						value={value.service_id ?? ""}
						onChange={(e) =>
							onChange({ ...value, service_id: e.target.value || null })
						}
					>
						<option value="">Tüm servisler</option>
						{services.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</select>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Alert Tipi
					</Label>
					<select
						className="mt-1.5 h-9 w-full rounded-lg px-3 text-[13px]"
						style={{
							background: "var(--input-bg)",
							border: "1px solid var(--input-border)",
							color: "var(--text-primary)",
						}}
						value={value.alert_type}
						onChange={(e) =>
							onChange({ ...value, alert_type: e.target.value })
						}
					>
						{ALERT_TYPES.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Minimum Severity
					</Label>
					<div className="flex gap-1.5 mt-2">
						{(["info", "warn", "crit"] as Severity[]).map((s) => {
							const active = value.min_severity === s;
							const tone = severityTone(s);
							return (
								<button
									key={s}
									type="button"
									onClick={() => onChange({ ...value, min_severity: s })}
									className="flex-1 rounded-xl px-3 h-10 text-[13px] font-medium capitalize transition-all"
									style={{
										background: active ? tone.bg : "var(--surface-sunken)",
										border: `1px solid ${active ? tone.border : "transparent"}`,
										color: active ? tone.fg : "var(--text-muted)",
									}}
								>
									{s}
								</button>
							);
						})}
					</div>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Aksiyon
					</Label>
					<select
						className="mt-1.5 h-9 w-full rounded-lg px-3 text-[13px]"
						style={{
							background: "var(--input-bg)",
							border: "1px solid var(--input-border)",
							color: "var(--text-primary)",
						}}
						value={value.action}
						onChange={(e) =>
							onChange({ ...value, action: e.target.value as RunbookAction })
						}
					>
						{ACTIONS.map((a) => (
							<option key={a.id} value={a.id}>
								{a.label} — {a.help}
							</option>
						))}
					</select>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Aktif
					</Label>
					<div className="flex h-9 items-center mt-1.5">
						<Switch
							checked={value.enabled !== false}
							onCheckedChange={(checked) =>
								onChange({ ...value, enabled: checked })
							}
						/>
					</div>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Cooldown (s)
					</Label>
					<Input
						type="number"
						min={0}
						value={value.cooldown_seconds}
						onChange={(e) =>
							onChange({
								...value,
								cooldown_seconds: Number(e.target.value) || 0,
							})
						}
						className="mt-1.5 h-9 text-[13px] rounded-lg"
					/>
				</div>
				<div>
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Saat başına maksimum
					</Label>
					<Input
						type="number"
						min={1}
						max={60}
						value={value.max_per_hour}
						onChange={(e) =>
							onChange({
								...value,
								max_per_hour: Number(e.target.value) || 6,
							})
						}
						className="mt-1.5 h-9 text-[13px] rounded-lg"
					/>
				</div>
				<div className="md:col-span-2">
					<Label
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						Args (JSON)
					</Label>
					<Textarea
						className="mt-1.5 min-h-[80px] font-mono text-[12px] rounded-lg"
						value={argsJson}
						onChange={(e) => {
							try {
								const parsed = JSON.parse(e.target.value || "{}");
								onChange({ ...value, args: parsed });
							} catch {
								/* ignore until valid JSON */
							}
						}}
					/>
					<div
						className="mt-1 text-[10px]"
						style={{ color: "var(--text-faint)" }}
					>
						exec için <span className="font-mono">{`{"command":"systemctl restart svc"}`}</span>,
						scale için <span className="font-mono">{`{"replicas":3}`}</span>,
						webhook için <span className="font-mono">{`{"url":"https://..."}`}</span>
					</div>
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
					disabled={submitting || !value.name.trim()}
				>
					{submitting ? (
						<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
					) : (
						<Play className="mr-1.5 h-3.5 w-3.5" />
					)}
					Oluştur
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function severityTone(s: Severity) {
	switch (s) {
		case "crit":
			return {
				bg: "var(--status-down-subtle)",
				fg: "var(--status-down-text)",
				border: "var(--status-down-border)",
			};
		case "warn":
			return {
				bg: "var(--status-degraded-subtle)",
				fg: "var(--status-degraded-text)",
				border: "var(--status-degraded-border)",
			};
		default:
			return {
				bg: "var(--color-blue-subtle)",
				fg: "var(--color-blue)",
				border: "var(--color-blue-border)",
			};
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
