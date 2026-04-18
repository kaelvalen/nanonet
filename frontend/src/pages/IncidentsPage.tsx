import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle2,
	FileText,
	Flame,
	Loader2,
	Save,
	Terminal,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	type IncidentDetail,
	type IncidentListItem,
	type TimelineEvent,
	incidentsApi,
} from "@/api/incidents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";

export function IncidentsPage() {
	const qc = useQueryClient();
	const [selected, setSelected] = useState<string | null>(null);

	const { data: list = [], isLoading } = useQuery({
		queryKey: ["incidents"],
		queryFn: () => incidentsApi.list(100),
		refetchInterval: 30_000,
	});

	const resolveMut = useMutation({
		mutationFn: incidentsApi.resolve,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["incidents"] });
			qc.invalidateQueries({ queryKey: ["incident"] });
			toast.success("Incident kapatıldı");
		},
	});

	const deleteMut = useMutation({
		mutationFn: incidentsApi.remove,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["incidents"] });
			setSelected(null);
			toast.success("Silindi");
		},
	});

	return (
		<PageShell width="wide">
			<PageHeader
				eyebrow="olay yönetimi"
				title="Incidents"
				description="Korelasyonlu uyarılar tek bir incident altında gruplanır. Açıklama ve postmortem ekleyerek hafıza oluşturun."
			/>

			<div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 mt-4 flex-1 min-h-0">
				<div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[calc(100vh-220px)]">
					{isLoading ? (
						<div className="space-y-2">
							{[0, 1, 2].map((i) => (
								<div
									key={i}
									className="h-20 rounded-lg animate-pulse"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
									}}
								/>
							))}
						</div>
					) : list.length === 0 ? (
						<EmptyState />
					) : (
						list.map((it) => (
							<IncidentRow
								key={it.id}
								item={it}
								active={selected === it.id}
								onSelect={() => setSelected(it.id)}
							/>
						))
					)}
				</div>

				<div className="min-w-0">
					{selected ? (
						<DetailPanel
							id={selected}
							onResolve={() => resolveMut.mutate(selected)}
							onDelete={() => deleteMut.mutate(selected)}
							onClose={() => setSelected(null)}
						/>
					) : (
						<div
							className="h-full rounded-lg flex items-center justify-center text-xs"
							style={{
								background: "var(--surface-card)",
								border: "1px dashed var(--border-default)",
								color: "var(--text-muted)",
							}}
						>
							Detay için sol taraftan bir incident seçin.
						</div>
					)}
				</div>
			</div>
		</PageShell>
	);
}

function IncidentRow({
	item,
	active,
	onSelect,
}: {
	item: IncidentListItem;
	active: boolean;
	onSelect: () => void;
}) {
	const open = !item.resolved_at;
	const tone = severityTone(item.severity);
	return (
		<button
			type="button"
			onClick={onSelect}
			className="text-left rounded-lg p-3 transition-colors"
			style={{
				background: active ? "var(--surface-overlay)" : "var(--surface-card)",
				border: `1px solid ${active ? "var(--border-strong)" : "var(--border-default)"}`,
			}}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span
						className="w-2 h-2 rounded-full shrink-0"
						style={{
							background: open ? tone.color : "var(--status-up)",
							boxShadow: open ? `0 0 8px ${tone.color}` : "none",
						}}
					/>
					<p
						className="text-sm font-bold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{item.title}
					</p>
				</div>
				<span
					className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
					style={{
						color: tone.color,
						background: tone.bg,
						border: `1px solid ${tone.color}33`,
					}}
				>
					{item.severity}
				</span>
			</div>
			<p
				className="mt-1.5 text-[10px] font-mono"
				style={{ color: "var(--text-muted)" }}
			>
				{item.service_name} · {item.alert_count} uyarı ·{" "}
				{relativeTime(item.started_at)}
				{item.resolved_at && " · çözüldü"}
			</p>
		</button>
	);
}

function DetailPanel({
	id,
	onResolve,
	onDelete,
	onClose,
}: {
	id: string;
	onResolve: () => void;
	onDelete: () => void;
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["incident", id],
		queryFn: () => incidentsApi.get(id),
		refetchInterval: 30_000,
	});

	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [postmortem, setPostmortem] = useState("");

	useEffect(() => {
		if (!data) return;
		setTitle(data.incident.title);
		setSummary(data.incident.summary ?? "");
		setPostmortem(data.incident.postmortem ?? "");
	}, [data]);

	const updateMut = useMutation({
		mutationFn: (patch: { title?: string; summary?: string; postmortem?: string }) =>
			incidentsApi.update(id, patch),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["incident", id] });
			qc.invalidateQueries({ queryKey: ["incidents"] });
			toast.success("Kaydedildi");
		},
	});

	if (isLoading || !data) {
		return (
			<div
				className="h-full rounded-lg flex items-center justify-center"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Loader2
					className="w-5 h-5 animate-spin"
					style={{ color: "var(--text-faint)" }}
				/>
			</div>
		);
	}

	const open = !data.incident.resolved_at;

	return (
		<div
			className="rounded-lg overflow-hidden flex flex-col h-full"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div
				className="flex items-start justify-between gap-3 px-4 py-3"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span
							className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
							style={{
								color: open
									? "var(--status-down-text)"
									: "var(--status-up-text)",
								background: open
									? "var(--status-down-subtle)"
									: "var(--status-up-subtle)",
								border: `1px solid ${
									open ? "var(--status-down-border)" : "var(--status-up-border)"
								}`,
							}}
						>
							{open ? "açık" : "çözüldü"}
						</span>
						<p
							className="text-[10px] font-mono"
							style={{ color: "var(--text-muted)" }}
						>
							{data.service_name} · {data.alert_count} uyarı
						</p>
					</div>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="mt-1.5 h-8 text-sm font-bold border-transparent focus-visible:border-[var(--border-strong)]"
						style={{ background: "transparent" }}
					/>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{open && (
						<Button
							size="sm"
							variant="outline"
							className="h-8 px-2.5 text-[11px]"
							onClick={onResolve}
						>
							<CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Kapat
						</Button>
					)}
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
					<Button
						size="sm"
						variant="ghost"
						className="h-8 w-8 p-0"
						onClick={onClose}
					>
						<X className="w-3.5 h-3.5" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
				<section>
					<Label
						className="text-[10px] uppercase tracking-[0.2em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Özet (one-liner)
					</Label>
					<Input
						value={summary}
						onChange={(e) => setSummary(e.target.value)}
						placeholder="Kısa, tek cümlelik açıklama"
						className="mt-1.5 h-9 text-sm"
					/>
				</section>

				<section>
					<Label
						className="text-[10px] uppercase tracking-[0.2em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Postmortem (markdown)
					</Label>
					<Textarea
						value={postmortem}
						onChange={(e) => setPostmortem(e.target.value)}
						placeholder={"## Sebep\n\n## Etki\n\n## Aksiyonlar"}
						className="mt-1.5 text-sm min-h-[160px] font-mono"
					/>
				</section>

				<div className="flex justify-end">
					<Button
						size="sm"
						className="h-8 px-3 text-xs text-white"
						style={{ background: "var(--gradient-btn-primary)" }}
						disabled={updateMut.isPending}
						onClick={() =>
							updateMut.mutate({
								title: title !== data.incident.title ? title : undefined,
								summary,
								postmortem,
							})
						}
					>
						{updateMut.isPending ? (
							<Loader2 className="w-3 h-3 mr-1 animate-spin" />
						) : (
							<Save className="w-3 h-3 mr-1" />
						)}
						Kaydet
					</Button>
				</div>

				<section>
					<Label
						className="text-[10px] uppercase tracking-[0.2em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Zaman Çizelgesi ({data.timeline.length})
					</Label>
					<div className="mt-3">
						<Timeline events={data.timeline} />
					</div>
				</section>
			</div>
		</div>
	);
}

function Timeline({ events }: { events: TimelineEvent[] }) {
	if (events.length === 0) {
		return (
			<p
				className="text-xs text-center py-6"
				style={{ color: "var(--text-muted)" }}
			>
				Bu pencerede olay kaydı yok.
			</p>
		);
	}
	return (
		<ol
			className="relative pl-5"
			style={{ borderLeft: "1px dashed var(--border-default)" }}
		>
			{events.map((e, idx) => {
				const meta = eventMeta(e);
				const Icon = meta.icon;
				return (
					<li
						key={`${e.timestamp}-${idx}`}
						className="relative pb-4 last:pb-0"
					>
						<span
							className="absolute -left-[26px] top-0.5 w-5 h-5 rounded flex items-center justify-center"
							style={{
								background: meta.bg,
								border: `1px solid ${meta.color}66`,
							}}
						>
							<Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
						</span>
						<div className="flex items-baseline gap-2">
							<span
								className="text-[10px] font-mono tabular-nums uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								{new Date(e.timestamp).toLocaleTimeString("tr-TR")}
							</span>
							<span
								className="text-xs font-bold truncate"
								style={{ color: "var(--text-primary)" }}
							>
								{meta.label} · {e.title}
							</span>
						</div>
						{e.detail && (
							<p
								className="mt-0.5 text-[11px] leading-relaxed"
								style={{ color: "var(--text-muted)" }}
							>
								{e.detail}
							</p>
						)}
					</li>
				);
			})}
		</ol>
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
				<FileText className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
			</span>
			<p
				className="text-sm font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				Henüz incident yok
			</p>
			<p
				className="text-xs leading-relaxed max-w-sm"
				style={{ color: "var(--text-muted)" }}
			>
				Yeni bir uyarı oluştuğunda otomatik olarak burada gruplanacak.
			</p>
		</div>
	);
}

function eventMeta(e: TimelineEvent) {
	switch (e.kind) {
		case "alert":
			return {
				label: "uyarı",
				icon: AlertTriangle,
				color: "var(--status-down)",
				bg: "var(--status-down-subtle)",
			};
		case "alert_resolved":
			return {
				label: "uyarı kapandı",
				icon: CheckCircle2,
				color: "var(--status-up)",
				bg: "var(--status-up-subtle)",
			};
		case "command":
			return {
				label: "komut",
				icon: Terminal,
				color: "var(--color-teal)",
				bg: "var(--color-teal-subtle)",
			};
		default:
			return {
				label: "durum",
				icon: Flame,
				color: "var(--status-warn)",
				bg: "var(--status-warn-subtle)",
			};
	}
}

function severityTone(s: string) {
	if (s === "crit") {
		return {
			color: "var(--status-down-text)",
			bg: "var(--status-down-subtle)",
		};
	}
	if (s === "warn") {
		return {
			color: "var(--status-warn-text)",
			bg: "var(--status-warn-subtle)",
		};
	}
	return {
		color: "var(--text-muted)",
		bg: "var(--surface-sunken)",
	};
}

function relativeTime(iso: string) {
	const d = new Date(iso);
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return "az önce";
	if (diff < 3600) return `${Math.floor(diff / 60)}d önce`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
	return d.toLocaleDateString("tr-TR");
}
