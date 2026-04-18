import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle2,
	FileText,
	Flame,
	Loader2,
	Save,
	Search,
	Terminal,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	type IncidentListItem,
	type TimelineEvent,
	incidentsApi,
} from "@/api/incidents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	FilterChip,
	Panel,
	SkeletonList,
	Toolbar,
	ToolbarChips,
	ToolbarDivider,
} from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/textarea";

type StatusFilter = "all" | "open" | "resolved";
type SeverityFilter = "all" | "crit" | "warn" | "info";

export function IncidentsPage() {
	const qc = useQueryClient();
	const [selected, setSelected] = useState<string | null>(null);
	const [status, setStatus] = useState<StatusFilter>("all");
	const [severity, setSeverity] = useState<SeverityFilter>("all");
	const [search, setSearch] = useState("");

	const { data: list = [], isLoading } = useQuery({
		queryKey: ["incidents"],
		queryFn: () => incidentsApi.list(100),
		refetchInterval: 30_000,
	});

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return list.filter((it) => {
			if (status === "open" && it.resolved_at) return false;
			if (status === "resolved" && !it.resolved_at) return false;
			if (severity !== "all" && it.severity !== severity) return false;
			if (
				q &&
				!it.title.toLowerCase().includes(q) &&
				!(it.service_name ?? "").toLowerCase().includes(q)
			) {
				return false;
			}
			return true;
		});
	}, [list, status, severity, search]);

	const counts = useMemo(() => {
		const c = { all: list.length, open: 0, resolved: 0 };
		for (const it of list) {
			if (it.resolved_at) c.resolved++;
			else c.open++;
		}
		return c;
	}, [list]);

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

	const filtersActive =
		status !== "all" || severity !== "all" || search.trim().length > 0;

	return (
		<PageShell width="wide">
			<PageHeader
				eyebrow="Olay yönetimi"
				title="Incidents"
				description="Korelasyonlu uyarılar tek bir incident altında gruplanır. Açıklama ve postmortem ekleyerek kurumsal hafıza oluşturun."
			/>

			<Toolbar className="flex-wrap gap-y-2">
				<ToolbarChips>
					<FilterChip
						active={status === "all"}
						onClick={() => setStatus("all")}
						count={counts.all}
					>
						Hepsi
					</FilterChip>
					<FilterChip
						active={status === "open"}
						onClick={() => setStatus("open")}
						count={counts.open}
						tone="danger"
					>
						Açık
					</FilterChip>
					<FilterChip
						active={status === "resolved"}
						onClick={() => setStatus("resolved")}
						count={counts.resolved}
						tone="success"
					>
						Çözüldü
					</FilterChip>
				</ToolbarChips>

				<ToolbarDivider />

				<ToolbarChips>
					<FilterChip
						active={severity === "all"}
						onClick={() => setSeverity("all")}
					>
						Tüm seviyeler
					</FilterChip>
					<FilterChip
						active={severity === "crit"}
						onClick={() => setSeverity("crit")}
						tone="danger"
					>
						Kritik
					</FilterChip>
					<FilterChip
						active={severity === "warn"}
						onClick={() => setSeverity("warn")}
						tone="warn"
					>
						Uyarı
					</FilterChip>
					<FilterChip
						active={severity === "info"}
						onClick={() => setSeverity("info")}
						tone="info"
					>
						Bilgi
					</FilterChip>
				</ToolbarChips>

				<ToolbarDivider />

				<div className="relative flex-1 min-w-[200px] max-w-xs">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Başlık veya servis ara…"
						className="h-8 pl-9 text-[12px] rounded-full"
					/>
				</div>

				{filtersActive && (
					<button
						type="button"
						onClick={() => {
							setStatus("all");
							setSeverity("all");
							setSearch("");
						}}
						className="text-[12px] font-medium px-3 h-8 rounded-full inline-flex items-center gap-1.5 transition-colors hover:bg-[var(--surface-sunken)]"
						style={{ color: "var(--text-muted)" }}
					>
						<X className="w-3.5 h-3.5" /> Temizle
					</button>
				)}

				<span
					className="ml-auto text-[11px] tabular-nums font-medium"
					style={{ color: "var(--text-faint)" }}
				>
					{filtered.length}/{list.length} kayıt
				</span>
			</Toolbar>

			<div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,400px)_1fr] gap-4 mt-2 flex-1 min-h-0">
				<div className="flex flex-col gap-2 overflow-y-auto pr-1 min-h-0">
					{isLoading ? (
						<SkeletonList rows={4} rowHeight={84} />
					) : filtered.length === 0 ? (
						<SharedEmptyState
							icon={FileText}
							title={
								list.length === 0
									? "Henüz incident yok"
									: "Filtrelere uyan kayıt yok"
							}
							description={
								list.length === 0
									? "Yeni bir uyarı oluştuğunda otomatik olarak burada gruplanacak."
									: "Filtreleri temizleyip tekrar deneyin."
							}
							tone="muted"
						/>
					) : (
						filtered.map((it) => (
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
						<SharedEmptyState
							icon={FileText}
							title="Detay için bir incident seçin"
							description="Sol taraftaki listeden bir kayıt seçtiğinizde özet, postmortem ve zaman çizelgesi burada açılır."
							tone="muted"
							className="h-full"
						/>
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
	const dotColor = open ? tone.dot : "var(--status-up)";
	return (
		<button
			type="button"
			onClick={onSelect}
			className="group text-left rounded-xl p-3.5 transition-all hover:border-[color:var(--border-strong)]"
			style={{
				background: active ? "var(--surface-overlay)" : "var(--surface-card)",
				border: `1px solid ${active ? "var(--border-strong)" : "var(--border-default)"}`,
				boxShadow: active
					? "0 4px 12px -4px rgba(0,0,0,0.08)"
					: undefined,
			}}
		>
			<div className="flex items-start gap-3">
				<span
					className="relative flex items-center justify-center w-4 h-4 mt-1 shrink-0"
					aria-hidden
				>
					{open && (
						<span
							className="absolute inset-0 rounded-full"
							style={{
								background: dotColor,
								opacity: 0.25,
								animation: "nn-orb-breathe 2.4s ease-in-out infinite",
							}}
						/>
					)}
					<span
						className="relative w-2 h-2 rounded-full"
						style={{
							background: dotColor,
							boxShadow: open
								? `0 0 0 2px color-mix(in srgb, ${dotColor} 22%, transparent)`
								: undefined,
						}}
					/>
				</span>

				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<p
							className="text-[14px] font-semibold tracking-tight leading-snug truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{item.title}
						</p>
						<span
							className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
							style={{ color: tone.text, background: tone.bg }}
						>
							{severityLabel(item.severity)}
						</span>
					</div>
					<p
						className="mt-1 text-[12px] truncate"
						style={{ color: "var(--text-muted)" }}
					>
						<span style={{ color: "var(--text-secondary)" }}>
							{item.service_name}
						</span>
						<span className="mx-1.5" style={{ color: "var(--text-faint)" }}>
							·
						</span>
						{item.alert_count} uyarı
						<span className="mx-1.5" style={{ color: "var(--text-faint)" }}>
							·
						</span>
						{relativeTime(item.started_at)}
						{item.resolved_at && (
							<>
								<span
									className="mx-1.5"
									style={{ color: "var(--text-faint)" }}
								>
									·
								</span>
								<span style={{ color: "var(--status-up-text)" }}>çözüldü</span>
							</>
						)}
					</p>
				</div>
			</div>
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
			<Panel className="h-full flex items-center justify-center">
				<Loader2
					className="w-5 h-5 animate-spin"
					style={{ color: "var(--text-faint)" }}
				/>
			</Panel>
		);
	}

	const open = !data.incident.resolved_at;
	const dotColor = open ? "var(--status-down)" : "var(--status-up)";

	return (
		<Panel padding="none" className="overflow-hidden flex flex-col h-full">
			<div
				className="flex items-start justify-between gap-3 px-5 py-4"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 mb-2">
						<span
							className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
							style={{
								background: open
									? "var(--status-down-subtle)"
									: "var(--status-up-subtle)",
								color: open
									? "var(--status-down-text)"
									: "var(--status-up-text)",
							}}
						>
							<span
								className="w-1.5 h-1.5 rounded-full"
								style={{ background: dotColor }}
							/>
							{open ? "Açık" : "Çözüldü"}
						</span>
						<span
							className="text-[12px]"
							style={{ color: "var(--text-muted)" }}
						>
							<span style={{ color: "var(--text-secondary)" }}>
								{data.service_name}
							</span>
							<span className="mx-1.5" style={{ color: "var(--text-faint)" }}>
								·
							</span>
							{data.alert_count} uyarı
						</span>
					</div>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="h-9 text-[15px] font-semibold tracking-tight border-transparent rounded-lg focus-visible:border-[var(--border-strong)] -ml-2 px-2"
						style={{ background: "transparent" }}
					/>
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					{open && (
						<Button
							size="sm"
							variant="outline"
							className="h-8 px-3 rounded-full text-[12px] font-medium"
							onClick={onResolve}
						>
							<CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Kapat
						</Button>
					)}
					<Button
						size="sm"
						variant="ghost"
						className="h-8 w-8 p-0 rounded-full"
						onClick={onDelete}
						aria-label="Sil"
					>
						<Trash2
							className="w-4 h-4"
							style={{ color: "var(--status-down)" }}
						/>
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 w-8 p-0 rounded-full"
						onClick={onClose}
						aria-label="Kapat"
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
				<section>
					<label
						className="text-[12px] font-medium block mb-2"
						style={{ color: "var(--text-muted)" }}
					>
						Özet (one-liner)
					</label>
					<Input
						value={summary}
						onChange={(e) => setSummary(e.target.value)}
						placeholder="Kısa, tek cümlelik açıklama"
						className="h-10 text-[13px] rounded-lg"
					/>
				</section>

				<section>
					<label
						className="text-[12px] font-medium block mb-2"
						style={{ color: "var(--text-muted)" }}
					>
						Postmortem (markdown)
					</label>
					<Textarea
						value={postmortem}
						onChange={(e) => setPostmortem(e.target.value)}
						placeholder={"## Sebep\n\n## Etki\n\n## Aksiyonlar"}
						className="text-[13px] min-h-[180px] font-mono rounded-lg leading-relaxed"
					/>
				</section>

				<div className="flex justify-end">
					<Button
						size="sm"
						className="h-9 px-4 rounded-full text-[12px] font-semibold text-white"
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
							<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
						) : (
							<Save className="w-3.5 h-3.5 mr-1.5" />
						)}
						Kaydet
					</Button>
				</div>

				<section>
					<div className="flex items-baseline gap-2 mb-3">
						<h3
							className="text-[13px] font-semibold tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							Zaman çizelgesi
						</h3>
						<span
							className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
							style={{
								color: "var(--text-muted)",
								background: "var(--surface-sunken)",
							}}
						>
							{data.timeline.length}
						</span>
					</div>
					<Timeline events={data.timeline} />
				</section>
			</div>
		</Panel>
	);
}

function Timeline({ events }: { events: TimelineEvent[] }) {
	if (events.length === 0) {
		return (
			<p
				className="text-[12px] text-center py-8"
				style={{ color: "var(--text-muted)" }}
			>
				Bu pencerede olay kaydı yok.
			</p>
		);
	}
	return (
		<ol className="relative pl-7 space-y-4">
			<span
				className="absolute left-2.5 top-1 bottom-1 w-px"
				style={{
					background:
						"linear-gradient(to bottom, var(--border-default), transparent)",
				}}
				aria-hidden
			/>
			{events.map((e, idx) => {
				const meta = eventMeta(e);
				const Icon = meta.icon;
				return (
					<li key={`${e.timestamp}-${idx}`} className="relative">
						<span
							className="absolute -left-[20px] top-0 w-5 h-5 rounded-full flex items-center justify-center"
							style={{
								background: "var(--background)",
								border: `1.5px solid ${meta.color}`,
							}}
						>
							<Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
						</span>
						<div className="flex items-baseline gap-2 flex-wrap">
							<span
								className="text-[14px] font-medium tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								{e.title}
							</span>
							<span
								className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
								style={{
									color: meta.color,
									background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
								}}
							>
								{meta.label}
							</span>
							<span
								className="ml-auto text-[11px] tabular-nums"
								style={{ color: "var(--text-faint)" }}
							>
								{new Date(e.timestamp).toLocaleTimeString("tr-TR", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</div>
						{e.detail && (
							<p
								className="mt-1 text-[12px] leading-relaxed"
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

function eventMeta(e: TimelineEvent) {
	switch (e.kind) {
		case "alert":
			return {
				label: "uyarı",
				icon: AlertTriangle,
				color: "var(--status-down)",
			};
		case "alert_resolved":
			return {
				label: "çözüldü",
				icon: CheckCircle2,
				color: "var(--status-up)",
			};
		case "command":
			return {
				label: "komut",
				icon: Terminal,
				color: "var(--color-teal)",
			};
		default:
			return {
				label: "durum",
				icon: Flame,
				color: "var(--status-warn)",
			};
	}
}

function severityTone(s: string) {
	if (s === "crit") {
		return {
			text: "var(--status-down-text)",
			bg: "var(--status-down-subtle)",
			dot: "var(--status-down)",
		};
	}
	if (s === "warn") {
		return {
			text: "var(--status-warn-text)",
			bg: "var(--status-warn-subtle)",
			dot: "var(--status-warn)",
		};
	}
	return {
		text: "var(--text-muted)",
		bg: "var(--surface-sunken)",
		dot: "var(--text-faint)",
	};
}

function severityLabel(s: string) {
	if (s === "crit") return "Kritik";
	if (s === "warn") return "Uyarı";
	if (s === "info") return "Bilgi";
	return s;
}

function relativeTime(iso: string) {
	const d = new Date(iso);
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return "az önce";
	if (diff < 3600) return `${Math.floor(diff / 60)}d önce`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
	return d.toLocaleDateString("tr-TR");
}
