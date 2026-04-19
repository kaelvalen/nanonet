import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Clock,
	Globe,
	Loader2,
	Pencil,
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
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	EmptyState as SharedEmptyState,
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

/* The draft editor is reused for both create and edit. We tag the working
   draft with the source probe's id when editing so the same UI can route
   to the right mutation on submit and show "Kaydet" instead of "Oluştur". */
type Draft = CreateProbeInput & { __editingId?: string };

export function ProbesPage() {
	const qc = useQueryClient();
	const [draft, setDraft] = useState<Draft | null>(null);

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
		onSuccess: (_data, variables) => {
			toast.success("Probe güncellendi");
			qc.invalidateQueries({ queryKey: ["probes"] });
			/* Close the editor only when the update came from the editor
			   (i.e. the user pressed "Kaydet"), not from a row-level toggle. */
			setDraft((d) => (d?.__editingId === variables.id ? null : d));
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
						style={{ color: "var(--text-tertiary)" }}
					>
						<span className="inline-flex items-center gap-1.5 tnum">
							<CheckCircle2
								className="h-3.5 w-3.5"
								style={{ color: "var(--status-up)" }}
							/>
							{upCount} up
						</span>
						<span className="inline-flex items-center gap-1.5 tnum">
							<XCircle
								className="h-3.5 w-3.5"
								style={{ color: "var(--status-down)" }}
							/>
							{downCount} down
						</span>
						<span className="inline-flex items-center gap-1.5 tnum">
							<Activity
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
						Yeni probe
					</Button>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
				{draft && (
					<DraftEditor
						value={draft}
						editing={Boolean(draft.__editingId)}
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
						icon={Activity}
						title="Henüz probe yok"
						description="Public bir endpoint'i veya 3rd-party API'yi izlemek için bir HTTP/TCP probe ekleyin."
						tone="accent"
						size="lg"
						action={
							<Button size="sm" onClick={() => setDraft(DEFAULT_DRAFT)}>
								<Plus className="mr-1.5 h-3.5 w-3.5" />
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
								editing={draft?.__editingId === p.id}
								onToggle={(enabled) =>
									updateMut.mutate({ id: p.id, patch: { enabled } })
								}
								onEdit={() =>
									setDraft({
										__editingId: p.id,
										name: p.name,
										kind: p.kind,
										target: p.target,
										method: p.method ?? "GET",
										expected_status: p.expected_status ?? 200,
										body_contains: p.body_contains ?? null,
										interval_seconds: p.interval_seconds,
										timeout_seconds: p.timeout_seconds,
										enabled: p.enabled,
									})
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
	editing,
	onToggle,
	onEdit,
	onDelete,
	busy,
}: {
	probe: Probe;
	editing: boolean;
	onToggle: (enabled: boolean) => void;
	onEdit: () => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const tone = statusTone(probe.last_status);
	const Icon = KIND_META[probe.kind].icon;
	return (
		<div
			className="relative rounded-[6px] px-4 py-3 transition-colors"
			style={{
				background: editing ? "var(--surface-sunken)" : "var(--surface-base)",
				border: editing
					? "1px solid var(--border-strong)"
					: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: tone.dot }}
			/>
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pl-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2.5 flex-wrap">
						<span
							className="w-8 h-8 rounded-[6px] flex items-center justify-center"
							style={{ background: "var(--surface-sunken)" }}
						>
							<Icon
								className="h-4 w-4"
								style={{ color: "var(--text-tertiary)" }}
							/>
						</span>
						<span
							className="text-[14px] font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							{probe.name}
						</span>
						<span
							className="inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
							style={{ background: tone.bg, color: tone.fg }}
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
						style={{ color: "var(--text-tertiary)" }}
					>
						{probe.target}
					</div>
					<div
						className="mt-2 flex items-center gap-3 flex-wrap text-[11px]"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="font-medium uppercase tracking-wider">
							{KIND_META[probe.kind].label}
						</span>
						<span>
							her <span className="tnum">{probe.interval_seconds}</span>s
						</span>
						<span>
							timeout <span className="tnum">{probe.timeout_seconds}</span>s
						</span>
						{probe.last_latency_ms != null && (
							<span
								className="font-mono tnum"
								style={{ color: "var(--text-tertiary)" }}
							>
								{probe.last_latency_ms}ms
							</span>
						)}
						{probe.last_run_at && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--text-tertiary)" }}
							>
								<Clock className="h-3 w-3" />
								{relative(probe.last_run_at)}
							</span>
						)}
					</div>
					{probe.last_error && probe.last_status !== "up" && (
						<div
							className="relative mt-2.5 flex items-start gap-2 rounded-[6px] px-3 py-2 text-[12px]"
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
				<div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
					<Switch
						checked={probe.enabled}
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
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: Draft;
	editing: boolean;
	onChange: (v: Draft) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	return (
		<Panel className="mb-3" padding="none">
			<PanelHeader dense>
				{editing ? "Probe düzenle" : "Yeni probe"}
			</PanelHeader>
			<PanelBody scroll={false}>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<FieldLabel htmlFor="probe-name">Ad</FieldLabel>
						<Input
							id="probe-name"
							value={value.name}
							onChange={(e) => onChange({ ...value, name: e.target.value })}
							placeholder="Public API"
							className="mt-1.5 h-9 text-[13px]"
						/>
					</div>
					<div>
						<FieldLabel>Tür</FieldLabel>
						<div
							role="radiogroup"
							aria-label="Probe tipi"
							className="flex gap-1 mt-1.5 p-0.5 rounded-[6px]"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							{(["http", "tcp"] as const).map((k) => {
								const active = value.kind === k;
								return (
									// biome-ignore lint/a11y/useSemanticElements: segmented control inside explicit radiogroup
									<button
										key={k}
										type="button"
										role="radio"
										aria-checked={active}
										onClick={() => onChange({ ...value, kind: k })}
										className="flex-1 rounded-[4px] px-3 h-8 text-[12px] font-medium transition-colors"
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
										{KIND_META[k].label}
									</button>
								);
							})}
						</div>
					</div>
					<div className="md:col-span-2">
						<FieldLabel htmlFor="probe-target">Hedef</FieldLabel>
						<Input
							id="probe-target"
							value={value.target}
							onChange={(e) => onChange({ ...value, target: e.target.value })}
							placeholder={KIND_META[value.kind].help}
							className="mt-1.5 h-9 text-[13px] font-mono"
						/>
					</div>
					{value.kind === "http" && (
						<>
							<div>
								<FieldLabel htmlFor="probe-method">Method</FieldLabel>
								<Input
									id="probe-method"
									value={value.method ?? "GET"}
									onChange={(e) =>
										onChange({
											...value,
											method: e.target.value.toUpperCase(),
										})
									}
									className="mt-1.5 h-9 text-[13px] font-mono"
								/>
							</div>
							<div>
								<FieldLabel htmlFor="probe-status">Beklenen status</FieldLabel>
								<Input
									id="probe-status"
									type="number"
									value={value.expected_status ?? 200}
									onChange={(e) =>
										onChange({
											...value,
											expected_status: Number(e.target.value) || 200,
										})
									}
									className="mt-1.5 h-9 text-[13px] font-mono tnum"
								/>
							</div>
							<div className="md:col-span-2">
								<FieldLabel htmlFor="probe-body">
									Body içermeli (opsiyonel)
								</FieldLabel>
								<Input
									id="probe-body"
									value={value.body_contains ?? ""}
									onChange={(e) =>
										onChange({
											...value,
											body_contains: e.target.value || null,
										})
									}
									placeholder='örn. "ok" veya "status":"healthy"'
									className="mt-1.5 h-9 text-[13px] font-mono"
								/>
							</div>
						</>
					)}
					<div>
						<FieldLabel htmlFor="probe-interval">Aralık (saniye)</FieldLabel>
						<Input
							id="probe-interval"
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
							className="mt-1.5 h-9 text-[13px] font-mono tnum"
						/>
					</div>
					<div>
						<FieldLabel htmlFor="probe-timeout">Timeout (saniye)</FieldLabel>
						<Input
							id="probe-timeout"
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
							className="mt-1.5 h-9 text-[13px] font-mono tnum"
						/>
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
					disabled={submitting || !value.name.trim() || !value.target.trim()}
				>
					{submitting ? (
						<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
					) : editing ? (
						<Pencil className="mr-1.5 h-3.5 w-3.5" />
					) : (
						<Plus className="mr-1.5 h-3.5 w-3.5" />
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

function statusTone(s: ProbeStatus | null | undefined) {
	switch (s) {
		case "up":
			return {
				bg: "var(--status-up-subtle)",
				fg: "var(--status-up-text)",
				dot: "var(--status-up)",
			};
		case "degraded":
			return {
				bg: "var(--status-degraded-subtle)",
				fg: "var(--status-degraded-text)",
				dot: "var(--status-degraded)",
			};
		case "down":
			return {
				bg: "var(--status-down-subtle)",
				fg: "var(--status-down-text)",
				dot: "var(--status-down)",
			};
		default:
			return {
				bg: "var(--surface-sunken)",
				fg: "var(--text-tertiary)",
				dot: "var(--border-strong)",
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
