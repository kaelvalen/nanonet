import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowUpRight,
	Clock,
	Globe,
	LayoutGrid,
	List,
	Loader2,
	Search,
	Server,
	Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { demoApi } from "@/api/demo";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	type Status,
	StatusBadge,
	StatusDot,
} from "@/components/ui/status-atoms";
import { useServices } from "@/hooks/useServices";
import type { Service } from "@/types/service";

type Filter = "all" | Status;
type Range = "24h" | "7d" | "30d";

const FILTER_LABELS: Record<Filter, string> = {
	all: "Tümü",
	up: "Aktif",
	degraded: "Bozuk",
	down: "Offline",
	unknown: "Bilinmiyor",
};

const FILTER_ORDER: Filter[] = ["all", "up", "degraded", "down"];

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar

function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	renderLabel,
}: {
	options: readonly T[];
	value: T;
	onChange: (v: T) => void;
	renderLabel?: (opt: T) => React.ReactNode;
}) {
	return (
		<div
			className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-default)",
			}}
		>
			{options.map((opt) => (
				<button
					key={opt}
					type="button"
					onClick={() => onChange(opt)}
					className="relative px-2.5 h-7 rounded-md text-xs font-medium transition-colors"
					style={{
						background: value === opt ? "var(--surface-raised)" : "transparent",
						color: value === opt ? "var(--color-teal)" : "var(--text-muted)",
						boxShadow: value === opt ? "var(--btn-shadow)" : undefined,
					}}
				>
					{renderLabel ? renderLabel(opt) : opt}
				</button>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Uptime chip

function UptimeChip({ value }: { value: number }) {
	const color =
		value >= 99
			? "var(--status-up-text)"
			: value >= 95
				? "var(--status-warn-text)"
				: "var(--status-down-text)";
	const bg =
		value >= 99
			? "var(--status-up-subtle)"
			: value >= 95
				? "var(--status-warn-subtle)"
				: "var(--status-down-subtle)";
	return (
		<span
			className="inline-flex items-center px-1.5 h-5 text-[10px] font-mono font-semibold tabular-nums rounded"
			style={{ background: bg, color }}
		>
			{value.toFixed(1)}%
		</span>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service grid card

function ServiceCard({
	service,
	uptime,
}: {
	service: Service;
	uptime?: number;
}) {
	return (
		<Link to={`/app/services/${service.id}`} className="group block h-full">
			<div
				className="relative h-full p-4 transition-all overflow-hidden"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
					borderRadius: "var(--radius)",
				}}
			>
				<div className="flex items-start justify-between gap-3 mb-4">
					<div className="flex items-start gap-3 min-w-0 flex-1">
						<div
							className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
							style={{ background: "var(--surface-sunken)" }}
						>
							<Server
								className="w-4 h-4"
								style={{ color: "var(--text-muted)" }}
							/>
						</div>
						<div className="min-w-0 pt-0.5">
							<h3
								className="text-sm font-semibold truncate leading-tight"
								style={{ color: "var(--text-primary)" }}
							>
								{service.name}
							</h3>
							<p
								className="text-[11px] font-mono truncate mt-1"
								style={{ color: "var(--text-faint)" }}
							>
								{service.host}:{service.port}
							</p>
						</div>
					</div>
					<StatusBadge status={service.status} />
				</div>

				<div
					className="flex items-center justify-between pt-3 text-[11px]"
					style={{ borderTop: "1px solid var(--border-subtle)" }}
				>
					<div
						className="flex items-center gap-3"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="inline-flex items-center gap-1">
							<Clock className="w-3 h-3" />
							{service.poll_interval_sec}s
						</span>
						<span className="inline-flex items-center gap-1 truncate max-w-32">
							<Globe className="w-3 h-3 shrink-0" />
							<span className="truncate">{service.health_endpoint}</span>
						</span>
					</div>
					<div className="flex items-center gap-2">
						{uptime != null && <UptimeChip value={uptime} />}
						<ArrowUpRight
							className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
							style={{ color: "var(--text-muted)" }}
						/>
					</div>
				</div>
			</div>
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service list row

function ServiceRow({
	service,
	uptime,
	isLast,
}: {
	service: Service;
	uptime?: number;
	isLast: boolean;
}) {
	return (
		<Link
			to={`/app/services/${service.id}`}
			className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)]"
			style={{
				borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
			}}
		>
			<StatusDot status={service.status} />
			<span
				className="flex-1 text-sm font-medium truncate"
				style={{ color: "var(--text-primary)" }}
			>
				{service.name}
			</span>
			<span
				className="text-xs font-mono hidden sm:block shrink-0"
				style={{ color: "var(--text-faint)" }}
			>
				{service.host}:{service.port}
			</span>
			<span
				className="hidden md:inline-flex items-center gap-1 text-xs shrink-0"
				style={{ color: "var(--text-faint)" }}
			>
				<Clock className="w-3 h-3" />
				{service.poll_interval_sec}s
			</span>
			<div className="shrink-0 w-16 flex justify-end">
				{uptime != null && <UptimeChip value={uptime} />}
			</div>
			<StatusBadge status={service.status} />
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state

function EmptyResults({ hasServices }: { hasServices: boolean }) {
	const qc = useQueryClient();
	const seed = useMutation({
		mutationFn: () => demoApi.seed(),
		onSuccess: (data) => {
			qc.invalidateQueries({ queryKey: ["services"] });
			qc.invalidateQueries({ queryKey: ["servicesUptime"] });
			toast.success(`${data.created_count} demo servis yüklendi`);
		},
		onError: (err: unknown) => {
			const msg =
				(err as { response?: { data?: { error?: string } } })?.response?.data
					?.error ?? "Demo verisi yüklenemedi";
			toast.error(msg);
		},
	});

	return (
		<div
			className="p-12 text-center rounded-lg"
			style={{
				background: "var(--surface-card)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<div
				className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
				style={{ background: "var(--surface-sunken)" }}
			>
				<Server className="w-6 h-6" style={{ color: "var(--text-faint)" }} />
			</div>
			<p
				className="text-sm font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				{hasServices ? "Filtreye uygun servis yok" : "Henüz servis eklenmedi"}
			</p>
			<p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
				{hasServices
					? "Arama veya filtre kriterlerini değiştirin"
					: "Sağ üstten ilk servisinizi ekleyin — veya hızlıca arayüzü tanımak için demo veriyi yükleyin"}
			</p>
			{!hasServices && (
				<button
					type="button"
					onClick={() => seed.mutate()}
					disabled={seed.isPending}
					className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-md disabled:opacity-60"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
				>
					{seed.isPending ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-amber)" }} />
					)}
					{seed.isPending ? "Yükleniyor..." : "Demo veriyi yükle (4 servis · 6 saat metric)"}
				</button>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeletons

function LoadingGrid() {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
			{Array.from({ length: 6 }, (_, i) => i).map((i) => (
				<div
					key={i}
					className="p-4 animate-pulse rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<div className="flex items-center gap-3">
						<div
							className="w-9 h-9 rounded-lg"
							style={{ background: "var(--surface-sunken)" }}
						/>
						<div className="flex-1 space-y-2">
							<div
								className="h-3.5 w-32 rounded"
								style={{ background: "var(--surface-sunken)" }}
							/>
							<div
								className="h-2.5 w-24 rounded"
								style={{ background: "var(--surface-sunken)" }}
							/>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function ServicesPage() {
	const { services, isLoading } = useServices();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<Filter>("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [slaRange, setSlaRange] = useState<Range>("24h");

	const { data: uptimeMap = {} } = useQuery({
		queryKey: ["bulkUptime", slaRange],
		queryFn: () => metricsApi.getBulkUptime(slaRange),
		staleTime: 5 * 60_000,
		gcTime: 10 * 60_000,
		enabled: services.length > 0,
	});

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return services.filter((s) => {
			const matchesSearch =
				!q ||
				s.name.toLowerCase().includes(q) ||
				s.host.toLowerCase().includes(q);
			const matchesStatus = statusFilter === "all" || s.status === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [services, search, statusFilter]);

	const statusCounts = useMemo(() => {
		const counts: Record<Filter, number> = {
			all: services.length,
			up: 0,
			degraded: 0,
			down: 0,
			unknown: 0,
		};
		for (const s of services) {
			if (s.status in counts) {
				counts[s.status as Filter]++;
			}
		}
		return counts;
	}, [services]);

	return (
		<PageShell width="wide" fill>
			<PageHeader
				compact
				eyebrow="Servisler"
				title="Tüm servisler"
				description={
					isLoading
						? "Yükleniyor…"
						: services.length === 0
							? "Henüz servis eklenmedi"
							: `${services.length} servis izleniyor`
				}
				actions={<AddServiceDialog />}
			/>

			{/* Toolbar */}
			<div className="flex flex-col md:flex-row gap-2 mb-4 shrink-0">
				{/* Search */}
				<div className="relative flex-1 min-w-0">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						placeholder="İsim veya host ile ara…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9 h-9 text-sm"
						style={{
							background: "var(--surface-card)",
							borderColor: "var(--border-default)",
						}}
					/>
				</div>

				{/* Status filter */}
				<SegmentedControl
					options={FILTER_ORDER}
					value={statusFilter}
					onChange={setStatusFilter}
					renderLabel={(opt) => (
						<span className="inline-flex items-center gap-1.5">
							{FILTER_LABELS[opt]}
							{statusCounts[opt] > 0 && (
								<span
									className="text-[10px] tabular-nums font-mono"
									style={{ opacity: 0.6 }}
								>
									{statusCounts[opt]}
								</span>
							)}
						</span>
					)}
				/>

				{/* SLA range */}
				<SegmentedControl
					options={["24h", "7d", "30d"] as const}
					value={slaRange}
					onChange={setSlaRange}
				/>

				{/* View toggle */}
				<div
					className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-default)",
					}}
				>
					<button
						type="button"
						onClick={() => setViewMode("grid")}
						className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
						style={{
							background:
								viewMode === "grid" ? "var(--surface-raised)" : "transparent",
							color:
								viewMode === "grid" ? "var(--color-teal)" : "var(--text-faint)",
							boxShadow: viewMode === "grid" ? "var(--btn-shadow)" : undefined,
						}}
					>
						<LayoutGrid className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						onClick={() => setViewMode("list")}
						className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
						style={{
							background:
								viewMode === "list" ? "var(--surface-raised)" : "transparent",
							color:
								viewMode === "list" ? "var(--color-teal)" : "var(--text-faint)",
							boxShadow: viewMode === "list" ? "var(--btn-shadow)" : undefined,
						}}
					>
						<List className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{/* Results — scrollable viewport-fit container */}
			<div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 pb-4">
				{isLoading ? (
					<LoadingGrid />
				) : filtered.length === 0 ? (
					<EmptyResults hasServices={services.length > 0} />
				) : viewMode === "grid" ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
						<AnimatePresence mode="popLayout">
							{filtered.map((service, i) => (
								<motion.div
									key={service.id}
									layout
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.96 }}
									transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.025 }}
								>
									<ServiceCard
										service={service}
										uptime={uptimeMap[service.id]}
									/>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				) : (
					<div
						className="overflow-hidden rounded-lg"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						{filtered.map((service, i) => (
							<ServiceRow
								key={service.id}
								service={service}
								uptime={uptimeMap[service.id]}
								isLast={i === filtered.length - 1}
							/>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}
