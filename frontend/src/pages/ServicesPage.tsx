import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpRight,
	Loader2,
	Search,
	Server,
	Sparkles,
	X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { demoApi } from "@/api/demo";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { type Status, StatusDot } from "@/components/ui/status-atoms";
import { useServices } from "@/hooks/useServices";
import type { Service } from "@/types/service";

/* ServicesPage — hybrid: spotlight + dense list.

   Top: 3 spotlight cards for the most "demanding-attention" services
   (down → degraded → lowest uptime). If everything is green and the user
   has services, we still show 3 quiet cards (top by SLA) so the slot has
   meaning rather than collapsing.

   Bottom: dense table with the full list. SRE-ergonomic — single row
   per service, tabular numbers, click → detail. Filtering, search and
   sorting all derive from the same source-of-truth list.

   No view-mode toggle (dropped from legacy). The hybrid covers both
   scan-density (table) and quick-glance (spotlight) without the
   maintenance debt of a second mode. */

type StatusFilter = "all" | Status;
type Range = "24h" | "7d" | "30d";
type SortKey = "name" | "status" | "uptime" | "host" | "poll";
type SortDir = "asc" | "desc";

const FILTER_LABELS: Record<StatusFilter, string> = {
	all: "Tümü",
	up: "Aktif",
	degraded: "Bozuk",
	down: "Kapalı",
	unknown: "Bilinmiyor",
};

const FILTER_ORDER: StatusFilter[] = [
	"all",
	"up",
	"degraded",
	"down",
	"unknown",
];
const RANGE_OPTIONS: Range[] = ["24h", "7d", "30d"];

const STATUS_RANK: Record<Status, number> = {
	down: 0,
	degraded: 1,
	unknown: 2,
	up: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Atoms

function Segmented<T extends string>({
	options,
	value,
	onChange,
	renderLabel,
	ariaLabel,
}: {
	options: readonly T[];
	value: T;
	onChange: (v: T) => void;
	renderLabel?: (opt: T) => React.ReactNode;
	ariaLabel: string;
}) {
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className="inline-flex items-center h-8 rounded-[6px] p-0.5"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{options.map((opt) => {
				const active = value === opt;
				return (
					// biome-ignore lint/a11y/useSemanticElements: visual segmented control inside an explicit radiogroup
					<button
						key={opt}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(opt)}
						className="px-2.5 h-7 rounded-[4px] text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						style={{
							background: active ? "var(--surface-base)" : "transparent",
							color: active ? "var(--text-primary)" : "var(--text-tertiary)",
							border: active
								? "1px solid var(--border-subtle)"
								: "1px solid transparent",
						}}
					>
						{renderLabel ? renderLabel(opt) : opt}
					</button>
				);
			})}
		</div>
	);
}

function UptimeText({
	value,
	size = 12,
}: {
	value: number | undefined;
	size?: number;
}) {
	if (value == null) {
		return (
			<span
				className="tnum"
				style={{ color: "var(--text-faint)", fontSize: size }}
			>
				—
			</span>
		);
	}
	const tone =
		value >= 99
			? "var(--status-up-text)"
			: value >= 95
				? "var(--status-degraded-text)"
				: "var(--status-down-text)";
	return (
		<span
			className="tnum font-semibold"
			style={{ color: tone, fontSize: size }}
		>
			{value.toFixed(value >= 99.95 ? 2 : 1)}
			<span
				className="font-normal ml-0.5"
				style={{ color: "var(--text-faint)" }}
			>
				%
			</span>
		</span>
	);
}

function StatusPill({ status }: { status: Status }) {
	const tone =
		status === "up"
			? {
					text: "var(--status-up-text)",
					bg: "var(--status-up-subtle)",
					label: "Aktif",
				}
			: status === "degraded"
				? {
						text: "var(--status-degraded-text)",
						bg: "var(--status-degraded-subtle)",
						label: "Bozuk",
					}
				: status === "down"
					? {
							text: "var(--status-down-text)",
							bg: "var(--status-down-subtle)",
							label: "Kapalı",
						}
					: {
							text: "var(--text-tertiary)",
							bg: "var(--surface-sunken)",
							label: "Bilinmiyor",
						};
	return (
		<span
			className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[4px] text-[11px] font-medium tnum"
			style={{ color: tone.text, background: tone.bg }}
		>
			<StatusDot status={status} size={6} />
			{tone.label}
		</span>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spotlight — 3 cards for the most "interesting" services

function SpotlightCard({
	service,
	uptime,
	rank,
}: {
	service: Service;
	uptime?: number;
	rank: 1 | 2 | 3;
}) {
	const showAlert = service.status === "down" || service.status === "degraded";
	const accent =
		service.status === "down"
			? "var(--status-down)"
			: service.status === "degraded"
				? "var(--status-degraded)"
				: "var(--status-up)";

	return (
		<Link
			to={`/app/services/${service.id}`}
			className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-[6px]"
		>
			<article
				className="relative h-full p-4 rounded-[6px] transition-colors hover:border-[var(--border-default)]"
				style={{
					background: "var(--surface-base)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<span
					aria-hidden
					className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
					style={{ background: accent }}
				/>

				<header className="flex items-start justify-between gap-3 mb-3">
					<div className="min-w-0 flex-1 pl-2">
						<div className="flex items-center gap-2 mb-1">
							<span
								className="text-[10px] font-mono font-semibold uppercase tracking-wider tnum"
								style={{ color: "var(--text-faint)" }}
							>
								#{rank}
							</span>
							<StatusPill status={service.status} />
						</div>
						<h3
							className="text-[15px] font-semibold tracking-tight truncate"
							style={{ color: "var(--text-primary)" }}
							title={service.name}
						>
							{service.name}
						</h3>
						<p
							className="mt-0.5 text-[11px] font-mono truncate"
							style={{ color: "var(--text-tertiary)" }}
							title={`${service.host}:${service.port}`}
						>
							{service.host}:{service.port}
						</p>
					</div>
					<ArrowUpRight
						className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
						style={{ color: "var(--text-tertiary)" }}
					/>
				</header>

				<dl
					className="grid grid-cols-2 gap-3 pt-3 pl-2"
					style={{ borderTop: "1px solid var(--border-subtle)" }}
				>
					<div className="min-w-0">
						<dt
							className="text-[10px] uppercase tracking-wider font-semibold"
							style={{ color: "var(--text-faint)" }}
						>
							Uptime · 24s
						</dt>
						<dd className="mt-1">
							<UptimeText value={uptime} size={20} />
						</dd>
					</div>
					<div className="min-w-0">
						<dt
							className="text-[10px] uppercase tracking-wider font-semibold"
							style={{ color: "var(--text-faint)" }}
						>
							Poll
						</dt>
						<dd
							className="mt-1 text-[20px] font-semibold tnum leading-none"
							style={{ color: "var(--text-primary)" }}
						>
							{service.poll_interval_sec}
							<span
								className="text-[12px] font-normal ml-0.5"
								style={{ color: "var(--text-faint)" }}
							>
								s
							</span>
						</dd>
					</div>
				</dl>

				{showAlert && (
					<div
						className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-[11px]"
						style={{
							background: "var(--status-down-subtle)",
							color: "var(--status-down-text)",
						}}
					>
						<AlertCircle className="w-3 h-3 shrink-0" />
						<span className="truncate">İnceleme gerekiyor</span>
					</div>
				)}
			</article>
		</Link>
	);
}

function SpotlightStrip({
	services,
	uptimeMap,
}: {
	services: Service[];
	uptimeMap: Record<string, number>;
}) {
	const ranked = useMemo(() => {
		const sorted = [...services].sort((a, b) => {
			const sa = STATUS_RANK[a.status as Status];
			const sb = STATUS_RANK[b.status as Status];
			if (sa !== sb) return sa - sb;
			const ua = uptimeMap[a.id] ?? 100;
			const ub = uptimeMap[b.id] ?? 100;
			if (ua !== ub) return ua - ub;
			return a.name.localeCompare(b.name, "tr");
		});
		return sorted.slice(0, 3);
	}, [services, uptimeMap]);

	if (ranked.length === 0) return null;

	return (
		<section aria-label="Öne çıkan servisler">
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
				{ranked.map((service, i) => (
					<SpotlightCard
						key={service.id}
						service={service}
						uptime={uptimeMap[service.id]}
						rank={(i + 1) as 1 | 2 | 3}
					/>
				))}
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table

function SortHeader({
	label,
	sortKey,
	current,
	dir,
	onChange,
	align = "left",
	className,
}: {
	label: string;
	sortKey: SortKey;
	current: SortKey;
	dir: SortDir;
	onChange: (k: SortKey) => void;
	align?: "left" | "right";
	className?: string;
}) {
	const active = current === sortKey;
	return (
		<th
			scope="col"
			className={`px-3 h-9 text-[10px] font-semibold uppercase tracking-wider ${className ?? ""}`}
			style={{
				color: "var(--text-tertiary)",
				background: "var(--surface-canvas)",
				borderBottom: "1px solid var(--border-subtle)",
				textAlign: align,
			}}
		>
			<button
				type="button"
				onClick={() => onChange(sortKey)}
				className={`inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)] outline-none rounded focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${align === "right" ? "flex-row-reverse" : ""}`}
				style={{
					color: active ? "var(--text-primary)" : "inherit",
				}}
			>
				{label}
				{active ? (
					dir === "asc" ? (
						<ArrowUp className="w-3 h-3" />
					) : (
						<ArrowDown className="w-3 h-3" />
					)
				) : (
					<span className="w-3 h-3" aria-hidden />
				)}
			</button>
		</th>
	);
}

function ServiceTable({
	services,
	uptimeMap,
	sort,
	dir,
	onSortChange,
}: {
	services: Service[];
	uptimeMap: Record<string, number>;
	sort: SortKey;
	dir: SortDir;
	onSortChange: (k: SortKey) => void;
}) {
	return (
		<div
			className="rounded-[6px] overflow-hidden"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div className="overflow-x-auto">
				<table className="w-full text-left border-separate border-spacing-0">
					<thead>
						<tr>
							<th
								scope="col"
								className="w-10 px-3 h-9"
								style={{
									background: "var(--surface-canvas)",
									borderBottom: "1px solid var(--border-subtle)",
								}}
								aria-label="Durum"
							/>
							<SortHeader
								label="Servis"
								sortKey="name"
								current={sort}
								dir={dir}
								onChange={onSortChange}
							/>
							<SortHeader
								label="Durum"
								sortKey="status"
								current={sort}
								dir={dir}
								onChange={onSortChange}
								className="hidden sm:table-cell"
							/>
							<SortHeader
								label="Host"
								sortKey="host"
								current={sort}
								dir={dir}
								onChange={onSortChange}
								className="hidden md:table-cell"
							/>
							<SortHeader
								label="Poll"
								sortKey="poll"
								current={sort}
								dir={dir}
								onChange={onSortChange}
								className="hidden lg:table-cell"
								align="right"
							/>
							<SortHeader
								label="Uptime"
								sortKey="uptime"
								current={sort}
								dir={dir}
								onChange={onSortChange}
								align="right"
							/>
							<th
								scope="col"
								aria-label="Aksiyon"
								className="w-10 px-3 h-9"
								style={{
									background: "var(--surface-canvas)",
									borderBottom: "1px solid var(--border-subtle)",
								}}
							/>
						</tr>
					</thead>
					<tbody>
						{services.map((service, i) => {
							const isLast = i === services.length - 1;
							const cellStyle = {
								borderBottom: isLast
									? "none"
									: "1px solid var(--border-subtle)",
							};
							return (
								<tr
									key={service.id}
									className="group transition-colors hover:bg-[var(--surface-sunken)] focus-within:bg-[var(--surface-sunken)]"
								>
									<td className="px-3 py-2.5 align-middle" style={cellStyle}>
										<StatusDot
											status={service.status as Status}
											size={8}
											pulse={service.status === "up"}
										/>
									</td>
									<td className="px-3 py-2.5 align-middle" style={cellStyle}>
										<Link
											to={`/app/services/${service.id}`}
											className="block min-w-0 outline-none rounded focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
										>
											<span
												className="block text-[13px] font-medium truncate"
												style={{ color: "var(--text-primary)" }}
											>
												{service.name}
											</span>
											<span
												className="sm:hidden block text-[11px] font-mono truncate mt-0.5"
												style={{ color: "var(--text-tertiary)" }}
											>
												{service.host}:{service.port}
											</span>
										</Link>
									</td>
									<td
										className="hidden sm:table-cell px-3 py-2.5 align-middle"
										style={cellStyle}
									>
										<StatusPill status={service.status as Status} />
									</td>
									<td
										className="hidden md:table-cell px-3 py-2.5 align-middle"
										style={cellStyle}
									>
										<span
											className="text-[12px] font-mono truncate inline-block max-w-[280px]"
											style={{ color: "var(--text-tertiary)" }}
											title={`${service.host}:${service.port}${service.health_endpoint}`}
										>
											{service.host}:{service.port}
										</span>
									</td>
									<td
										className="hidden lg:table-cell px-3 py-2.5 align-middle text-right"
										style={cellStyle}
									>
										<span
											className="text-[12px] tnum"
											style={{ color: "var(--text-secondary)" }}
										>
											{service.poll_interval_sec}
											<span
												className="ml-0.5"
												style={{ color: "var(--text-faint)" }}
											>
												s
											</span>
										</span>
									</td>
									<td
										className="px-3 py-2.5 align-middle text-right"
										style={cellStyle}
									>
										<UptimeText value={uptimeMap[service.id]} size={13} />
									</td>
									<td
										className="px-3 py-2.5 align-middle text-right"
										style={cellStyle}
									>
										<ArrowUpRight
											className="w-3.5 h-3.5 inline-block opacity-0 group-hover:opacity-60 transition-opacity"
											style={{ color: "var(--text-tertiary)" }}
											aria-hidden
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states

function EmptyResults({ hasServices }: { hasServices: boolean }) {
	const qc = useQueryClient();
	const seed = useMutation({
		mutationFn: () => demoApi.seed(),
		onSuccess: (data) => {
			qc.invalidateQueries({ queryKey: ["services"] });
			qc.invalidateQueries({ queryKey: ["bulkUptime"] });
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
			className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-[6px]"
			style={{
				background: "var(--surface-base)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-4"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Server className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
			</span>
			<h3
				className="text-[15px] font-semibold mb-1.5"
				style={{ color: "var(--text-primary)" }}
			>
				{hasServices ? "Filtreye uygun servis yok" : "Henüz servis eklenmedi"}
			</h3>
			<p
				className="text-[13px] max-w-md leading-relaxed mb-5"
				style={{ color: "var(--text-tertiary)" }}
			>
				{hasServices
					? "Arama veya filtre kriterlerini değiştirin."
					: "Sağ üstten ilk servisinizi ekleyin — ya da arayüzü tanımak için demo veriyi yükleyin."}
			</p>
			{!hasServices && (
				<button
					type="button"
					onClick={() => seed.mutate()}
					disabled={seed.isPending}
					className="inline-flex items-center gap-2 h-9 px-4 rounded-[6px] text-[12px] font-semibold disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] transition-colors hover:bg-[var(--surface-sunken)]"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
				>
					{seed.isPending ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<Sparkles className="w-3.5 h-3.5" />
					)}
					{seed.isPending ? "Yükleniyor…" : "Demo veriyi yükle"}
				</button>
			)}
		</div>
	);
}

function TableSkeleton() {
	return (
		<div
			className="rounded-[6px] overflow-hidden"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div
				className="h-9"
				style={{
					background: "var(--surface-canvas)",
					borderBottom: "1px solid var(--border-subtle)",
				}}
			/>
			{Array.from({ length: 6 }, (_, i) => i).map((i) => (
				<div
					key={i}
					className="flex items-center gap-3 px-3 h-12 animate-pulse"
					style={{
						borderBottom: i === 5 ? "none" : "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="w-2 h-2 rounded-full shrink-0"
						style={{ background: "var(--surface-sunken)" }}
					/>
					<div
						className="h-3 rounded flex-1 max-w-48"
						style={{ background: "var(--surface-sunken)" }}
					/>
					<div
						className="h-3 rounded w-20"
						style={{ background: "var(--surface-sunken)" }}
					/>
					<div
						className="h-3 rounded w-16"
						style={{ background: "var(--surface-sunken)" }}
					/>
				</div>
			))}
		</div>
	);
}

function SpotlightSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className="h-[152px] rounded-[6px] animate-pulse"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				/>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function ServicesPage() {
	const { services, isLoading } = useServices();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [slaRange, setSlaRange] = useState<Range>("24h");
	const [sort, setSort] = useState<SortKey>("status");
	const [dir, setDir] = useState<SortDir>("asc");

	const deferredSearch = useDeferredValue(search);

	const { data: uptimeMap = {} } = useQuery({
		queryKey: ["bulkUptime", slaRange],
		queryFn: () => metricsApi.getBulkUptime(slaRange),
		staleTime: 5 * 60_000,
		gcTime: 10 * 60_000,
		enabled: services.length > 0,
	});

	const filtered = useMemo(() => {
		const q = deferredSearch.trim().toLocaleLowerCase("tr-TR");
		const result = services.filter((s) => {
			const matchesSearch =
				!q ||
				s.name.toLocaleLowerCase("tr-TR").includes(q) ||
				s.host.toLocaleLowerCase("tr-TR").includes(q) ||
				s.health_endpoint.toLocaleLowerCase("tr-TR").includes(q);
			const matchesStatus = statusFilter === "all" || s.status === statusFilter;
			return matchesSearch && matchesStatus;
		});

		const sign = dir === "asc" ? 1 : -1;
		result.sort((a, b) => {
			let cmp = 0;
			switch (sort) {
				case "name":
					cmp = a.name.localeCompare(b.name, "tr");
					break;
				case "status":
					cmp =
						STATUS_RANK[a.status as Status] - STATUS_RANK[b.status as Status];
					if (cmp === 0) cmp = a.name.localeCompare(b.name, "tr");
					break;
				case "uptime": {
					const ua = uptimeMap[a.id] ?? -1;
					const ub = uptimeMap[b.id] ?? -1;
					cmp = ua - ub;
					break;
				}
				case "host":
					cmp = a.host.localeCompare(b.host);
					if (cmp === 0) cmp = a.port - b.port;
					break;
				case "poll":
					cmp = a.poll_interval_sec - b.poll_interval_sec;
					break;
			}
			return cmp * sign;
		});

		return result;
	}, [services, deferredSearch, statusFilter, sort, dir, uptimeMap]);

	const handleSortChange = (key: SortKey) => {
		if (key === sort) {
			setDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSort(key);
			setDir(key === "uptime" ? "desc" : "asc");
		}
	};

	const statusCounts = useMemo(() => {
		const counts: Record<StatusFilter, number> = {
			all: services.length,
			up: 0,
			degraded: 0,
			down: 0,
			unknown: 0,
		};
		for (const s of services) {
			counts[s.status as Status]++;
		}
		return counts;
	}, [services]);

	const headerDescription = isLoading
		? "Yükleniyor…"
		: services.length === 0
			? "Henüz servis eklenmedi"
			: `${services.length} servis · ${statusCounts.up} aktif · ${statusCounts.degraded + statusCounts.down} ilgi gerekiyor`;

	return (
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="Servisler"
				title="Tüm servisler"
				description={headerDescription}
				actions={<AddServiceDialog />}
			/>

			{/* ── Filter bar ─────────────────────────────────────────────── */}
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
				<div className="relative w-full lg:w-[320px] shrink-0">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
						style={{ color: "var(--text-tertiary)" }}
						aria-hidden
					/>
					<Input
						placeholder="İsim, host veya endpoint ile ara…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9 pr-8 h-9 text-[13px]"
						aria-label="Servis ara"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							aria-label="Aramayı temizle"
							className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-[var(--surface-sunken)]"
							style={{ color: "var(--text-tertiary)" }}
						>
							<X className="w-3 h-3" />
						</button>
					)}
				</div>

				<div className="flex items-center gap-2 flex-wrap">
					<Segmented
						ariaLabel="Durum filtresi"
						options={FILTER_ORDER}
						value={statusFilter}
						onChange={setStatusFilter}
						renderLabel={(opt) => (
							<span className="inline-flex items-center gap-1.5">
								{FILTER_LABELS[opt]}
								{statusCounts[opt] > 0 && (
									<span
										className="text-[10px] tnum"
										style={{
											color:
												statusFilter === opt
													? "var(--text-tertiary)"
													: "var(--text-faint)",
										}}
									>
										{statusCounts[opt]}
									</span>
								)}
							</span>
						)}
					/>
					<Segmented
						ariaLabel="SLA aralığı"
						options={RANGE_OPTIONS}
						value={slaRange}
						onChange={setSlaRange}
					/>
				</div>
			</div>

			{/* ── Spotlight + Table ──────────────────────────────────────── */}
			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-4">
				<div className="flex flex-col gap-4">
					{isLoading ? (
						<>
							<SpotlightSkeleton />
							<TableSkeleton />
						</>
					) : services.length === 0 ? (
						<EmptyResults hasServices={false} />
					) : filtered.length === 0 ? (
						<EmptyResults hasServices />
					) : (
						<>
							{/* Spotlight only when no active filter narrows the user's view */}
							{statusFilter === "all" && !deferredSearch && (
								<SpotlightStrip services={services} uptimeMap={uptimeMap} />
							)}
							<section aria-label="Tüm servisler">
								<header className="flex items-center justify-between mb-2 px-1">
									<h2
										className="text-[10px] uppercase tracking-wider font-semibold"
										style={{ color: "var(--text-faint)" }}
									>
										{filtered.length === services.length
											? `Liste · ${services.length}`
											: `Liste · ${filtered.length} / ${services.length}`}
									</h2>
									<span
										className="text-[10px] uppercase tracking-wider font-semibold"
										style={{ color: "var(--text-faint)" }}
									>
										SLA · {slaRange}
									</span>
								</header>
								<ServiceTable
									services={filtered}
									uptimeMap={uptimeMap}
									sort={sort}
									dir={dir}
									onSortChange={handleSortChange}
								/>
							</section>
						</>
					)}
				</div>
			</div>
		</PageShell>
	);
}
