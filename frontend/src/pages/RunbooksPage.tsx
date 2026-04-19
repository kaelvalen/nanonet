import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BookOpen,
	Loader2,
	Pause,
	Pencil,
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
	runbooksApi,
	type Severity,
} from "@/api/runbooks";
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

/* See ProbesPage for the rationale — same edit/create dual-mode draft pattern. */
type Draft = CreateRunbookInput & { __editingId?: string };

export function RunbooksPage() {
	const qc = useQueryClient();
	const { services } = useServices();
	const [draft, setDraft] = useState<Draft | null>(null);

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
		onSuccess: (_data, variables) => {
			qc.invalidateQueries({ queryKey: ["runbooks"] });
			setDraft((d) => (d?.__editingId === variables.id ? null : d));
			/* Toast only for full edits; toggling enabled on a row is silent so
			   it doesn't shout at the user for a tiny on/off flip. */
			if (Object.keys(variables.patch).length > 1) {
				toast.success("Runbook güncellendi");
			}
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
				description="Alert tetiklendiğinde otomatik aksiyon (restart, exec, webhook) çalıştırın."
				meta={
					<div
						className="flex items-center gap-3 text-[12px]"
						style={{ color: "var(--text-tertiary)" }}
					>
						<span className="inline-flex items-center gap-1.5 tnum">
							<Zap
								className="h-3.5 w-3.5"
								style={{ color: "var(--status-degraded)" }}
							/>
							{activeCount} aktif
						</span>
						<span className="inline-flex items-center gap-1.5 tnum">
							<BookOpen
								className="h-3.5 w-3.5"
								style={{ color: "var(--text-faint)" }}
							/>
							{items.length} toplam
						</span>
					</div>
				}
				actions={
					<Button size="sm" onClick={() => setDraft(DEFAULT_DRAFT)}>
						<Plus className="mr-1.5 h-3.5 w-3.5" />
						Yeni runbook
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
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

				{isLoading ? (
					<SkeletonList rows={4} rowHeight={88} />
				) : items.length === 0 && !draft ? (
					<SharedEmptyState
						icon={Pause}
						title="Henüz runbook yok"
						description="Tekrarlayan müdahaleleri otomatikleştirin: alert tetiklendiğinde restart/exec/webhook çalıştırın."
						tone="accent"
						size="lg"
						action={
							<Button size="sm" onClick={() => setDraft(DEFAULT_DRAFT)}>
								<Plus className="mr-1.5 h-3.5 w-3.5" />
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
								editing={draft?.__editingId === r.id}
								serviceName={
									r.service_id
										? (services.find((s) => s.id === r.service_id)?.name ?? "—")
										: "Tüm servisler"
								}
								onToggle={(enabled) =>
									updateMut.mutate({ id: r.id, patch: { enabled } })
								}
								onEdit={() =>
									setDraft({
										__editingId: r.id,
										name: r.name,
										service_id: r.service_id,
										alert_type: r.alert_type,
										min_severity: r.min_severity,
										action: r.action,
										args: r.args ?? {},
										enabled: r.enabled,
										cooldown_seconds: r.cooldown_seconds,
										max_per_hour: r.max_per_hour,
									})
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
	editing,
	serviceName,
	onToggle,
	onEdit,
	onDelete,
	busy,
}: {
	book: Runbook;
	editing: boolean;
	serviceName: string;
	onToggle: (enabled: boolean) => void;
	onEdit: () => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const sev = severityTone(book.min_severity);
	return (
		<div
			className="relative rounded-[6px] px-4 py-3 transition-colors"
			style={{
				background: editing ? "var(--surface-sunken)" : "var(--surface-base)",
				border: editing
					? "1px solid var(--border-strong)"
					: "1px solid var(--border-subtle)",
				opacity: book.enabled ? 1 : 0.6,
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{
					background: book.enabled ? sev.dot : "var(--border-strong)",
				}}
			/>
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pl-2">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className="text-[14px] font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							{book.name}
						</span>
						<span
							className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
							style={{ background: sev.bg, color: sev.fg }}
						>
							≥ {book.min_severity}
						</span>
						<span
							className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
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
						style={{ color: "var(--text-tertiary)" }}
					>
						<span className="font-mono">{book.alert_type}</span>
						<span className="mx-2" style={{ color: "var(--text-faint)" }}>
							→
						</span>
						<span>{serviceName}</span>
					</div>
					<div
						className="mt-2 flex items-center gap-3 flex-wrap text-[11px]"
						style={{ color: "var(--text-faint)" }}
					>
						<span>
							cooldown <span className="tnum">{book.cooldown_seconds}</span>s
						</span>
						<span>
							≤ <span className="tnum">{book.max_per_hour}</span>/sa
						</span>
						<span
							className="font-mono tnum"
							style={{ color: "var(--text-tertiary)" }}
						>
							{book.fire_count} kez tetiklendi
						</span>
						{book.last_fired_at && (
							<span style={{ color: "var(--text-tertiary)" }}>
								son: {relative(book.last_fired_at)}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
					<Switch
						checked={book.enabled}
						onCheckedChange={onToggle}
						disabled={busy}
					/>
					<Button
						variant="ghost"
						size="icon"
						onClick={onEdit}
						disabled={busy}
						aria-label="Düzenle"
					>
						<Pencil
							className="h-3.5 w-3.5"
							style={{ color: "var(--text-tertiary)" }}
						/>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={onDelete}
						disabled={busy}
						aria-label="Sil"
					>
						<Trash2
							className="h-3.5 w-3.5"
							style={{ color: "var(--status-down)" }}
						/>
					</Button>
				</div>
			</div>
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
	const argsJson = JSON.stringify(value.args ?? {}, null, 2);
	return (
		<Panel className="mb-3" padding="none">
			<PanelHeader dense>
				{editing ? "Runbook düzenle" : "Yeni runbook"}
			</PanelHeader>
			<PanelBody scroll={false}>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<FieldLabel htmlFor="rb-name">Ad</FieldLabel>
						<Input
							id="rb-name"
							value={value.name}
							onChange={(e) => onChange({ ...value, name: e.target.value })}
							placeholder="Auto-restart on CPU spike"
							className="mt-1.5 h-9 text-[13px]"
						/>
					</div>
					<div>
						<FieldLabel htmlFor="rb-service">Servis</FieldLabel>
						<Select
							value={value.service_id ?? "__all__"}
							onValueChange={(v) =>
								onChange({
									...value,
									service_id: v === "__all__" ? null : v,
								})
							}
						>
							<SelectTrigger id="rb-service" className="mt-1.5 h-9 text-[13px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all__">Tüm servisler</SelectItem>
								{services.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<FieldLabel htmlFor="rb-alert">Alert tipi</FieldLabel>
						<Select
							value={value.alert_type}
							onValueChange={(v) => onChange({ ...value, alert_type: v })}
						>
							<SelectTrigger id="rb-alert" className="mt-1.5 h-9 text-[13px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ALERT_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{t}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<FieldLabel>Minimum severity</FieldLabel>
						<div
							role="radiogroup"
							aria-label="Severity"
							className="flex gap-1 mt-1.5 p-0.5 rounded-[6px]"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							{(["info", "warn", "crit"] as Severity[]).map((s) => {
								const active = value.min_severity === s;
								return (
									// biome-ignore lint/a11y/useSemanticElements: segmented control inside explicit radiogroup
									<button
										key={s}
										type="button"
										role="radio"
										aria-checked={active}
										onClick={() => onChange({ ...value, min_severity: s })}
										className="flex-1 rounded-[4px] px-3 h-8 text-[12px] font-medium capitalize transition-colors"
										style={{
											background: active
												? "var(--surface-base)"
												: "transparent",
											color: active
												? "var(--text-primary)"
												: "var(--text-tertiary)",
											boxShadow: active
												? "0 0 0 1px var(--border-subtle)"
												: "none",
										}}
									>
										{s}
									</button>
								);
							})}
						</div>
					</div>
					<div>
						<FieldLabel htmlFor="rb-action">Aksiyon</FieldLabel>
						<Select
							value={value.action}
							onValueChange={(v) =>
								onChange({ ...value, action: v as RunbookAction })
							}
						>
							<SelectTrigger id="rb-action" className="mt-1.5 h-9 text-[13px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ACTIONS.map((a) => (
									<SelectItem key={a.id} value={a.id}>
										{a.label} — {a.help}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<FieldLabel>Aktif</FieldLabel>
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
						<FieldLabel htmlFor="rb-cool">Cooldown (s)</FieldLabel>
						<Input
							id="rb-cool"
							type="number"
							min={0}
							value={value.cooldown_seconds}
							onChange={(e) =>
								onChange({
									...value,
									cooldown_seconds: Number(e.target.value) || 0,
								})
							}
							className="mt-1.5 h-9 text-[13px] tnum"
						/>
					</div>
					<div>
						<FieldLabel htmlFor="rb-max">Saat başına maksimum</FieldLabel>
						<Input
							id="rb-max"
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
							className="mt-1.5 h-9 text-[13px] tnum"
						/>
					</div>
					<div className="md:col-span-2">
						<FieldLabel htmlFor="rb-args">Args (JSON)</FieldLabel>
						<Textarea
							id="rb-args"
							className="mt-1.5 min-h-[80px] font-mono text-[12px]"
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
							className="mt-1.5 text-[10px] leading-relaxed"
							style={{ color: "var(--text-faint)" }}
						>
							exec için{" "}
							<span className="font-mono">{`{"command":"systemctl restart svc"}`}</span>
							, scale için <span className="font-mono">{`{"replicas":3}`}</span>
							, webhook için{" "}
							<span className="font-mono">{`{"url":"https://..."}`}</span>
						</div>
					</div>
				</div>
			</PanelBody>
			<PanelFooter>
				<Button
					variant="outline"
					size="sm"
					onClick={onCancel}
					disabled={submitting}
				>
					İptal
				</Button>
				<Button
					size="sm"
					onClick={onSubmit}
					disabled={submitting || !value.name.trim()}
				>
					{submitting ? (
						<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
					) : editing ? (
						<Pencil className="mr-1.5 h-3.5 w-3.5" />
					) : (
						<Play className="mr-1.5 h-3.5 w-3.5" />
					)}
					{editing ? "Kaydet" : "Oluştur"}
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function FieldLabel({
	children,
	htmlFor,
}: {
	children: React.ReactNode;
	htmlFor?: string;
}) {
	return (
		<Label
			htmlFor={htmlFor}
			className="text-[11px] font-medium uppercase tracking-wider"
			style={{ color: "var(--text-faint)" }}
		>
			{children}
		</Label>
	);
}

function severityTone(s: Severity) {
	switch (s) {
		case "crit":
			return {
				bg: "var(--status-down-subtle)",
				fg: "var(--status-down-text)",
				dot: "var(--status-down)",
			};
		case "warn":
			return {
				bg: "var(--status-degraded-subtle)",
				fg: "var(--status-degraded-text)",
				dot: "var(--status-degraded)",
			};
		default:
			return {
				bg: "var(--brand-primary-subtle)",
				fg: "var(--brand-primary)",
				dot: "var(--brand-primary)",
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
