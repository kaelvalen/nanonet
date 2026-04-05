import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	Clock,
	Globe,
	HelpCircle,
	LayoutGrid,
	List,
	Search,
	Server,
	XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useServices } from "@/hooks/useServices";

type Status = "all" | "up" | "degraded" | "down" | "unknown";

const STATUS_LABELS: Record<Status, string> = {
	all: "Tümü",
	up: "Aktif",
	degraded: "Bozuk",
	down: "Çevrimdışı",
	unknown: "Bilinmiyor",
};

function statusStyles(status: string) {
	switch (status) {
		case "up":
			return {
				dot: "var(--status-up)",
				badgeBg: "var(--status-up-subtle)",
				badgeText: "var(--status-up-text)",
				accent: "var(--status-up-border)",
			};
		case "degraded":
			return {
				dot: "var(--status-warn)",
				badgeBg: "var(--status-warn-subtle)",
				badgeText: "var(--status-warn-text)",
				accent: "var(--status-warn-border)",
			};
		case "down":
			return {
				dot: "var(--status-down)",
				badgeBg: "var(--status-down-subtle)",
				badgeText: "var(--status-down-text)",
				accent: "var(--status-down-border)",
			};
		default:
			return {
				dot: "var(--text-faint)",
				badgeBg: "var(--surface-sunken)",
				badgeText: "var(--text-muted)",
				accent: "var(--border-subtle)",
			};
	}
}

function StatusIcon({ status }: { status: string }) {
	const cls = "w-3.5 h-3.5";
	if (status === "up")
		return (
			<CheckCircle2 className={cls} style={{ color: "var(--status-up)" }} />
		);
	if (status === "degraded")
		return (
			<AlertTriangle className={cls} style={{ color: "var(--status-warn)" }} />
		);
	if (status === "down")
		return <XCircle className={cls} style={{ color: "var(--status-down)" }} />;
	return <HelpCircle className={cls} style={{ color: "var(--text-faint)" }} />;
}

export function ServicesPage() {
	const { services, isLoading } = useServices();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<Status>("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [slaRange, setSlaRange] = useState<"24h" | "7d" | "30d">("24h");

	const { data: uptimeMap = {} } = useQuery({
		queryKey: ["bulkUptime", slaRange],
		queryFn: () => metricsApi.getBulkUptime(slaRange),
		staleTime: 5 * 60_000,
		gcTime: 10 * 60_000,
		enabled: services.length > 0,
	});

	const filtered = useMemo(() => {
		return services.filter((s) => {
			const matchesSearch =
				s.name.toLowerCase().includes(search.toLowerCase()) ||
				s.host.toLowerCase().includes(search.toLowerCase());
			const matchesStatus = statusFilter === "all" || s.status === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [services, search, statusFilter]);

	const statusCounts = useMemo(() => {
		const counts = {
			all: services.length,
			up: 0,
			degraded: 0,
			down: 0,
			unknown: 0,
		};
		for (const s of services) {
			if (s.status in counts) counts[s.status as keyof typeof counts]++;
		}
		return counts;
	}, [services]);

	return (
		<div className="space-y-5">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35 }}
				className="flex items-center justify-between"
			>
				<p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
					{services.length} servis izleniyor
				</p>
				<AddServiceDialog />
			</motion.div>

			{/* Toolbar */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, delay: 0.05 }}
				className="flex flex-col sm:flex-row gap-2"
			>
				{/* Search */}
				<div className="relative flex-1">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						placeholder="İsim veya host ara..."
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
				<div
					className="flex items-center gap-1 px-1 rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					{(["all", "up", "degraded", "down"] as Status[]).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatusFilter(s)}
							className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
							style={
								statusFilter === s
									? {
											background:
												s === "up"
													? "var(--status-up-subtle)"
													: s === "degraded"
														? "var(--status-warn-subtle)"
														: s === "down"
															? "var(--status-down-subtle)"
															: "var(--color-teal-subtle)",
											color:
												s === "up"
													? "var(--status-up-text)"
													: s === "degraded"
														? "var(--status-warn-text)"
														: s === "down"
															? "var(--status-down-text)"
															: "var(--color-teal)",
										}
									: { color: "var(--text-muted)" }
							}
						>
							{STATUS_LABELS[s]}
							{statusCounts[s] > 0 && (
								<span
									className="ml-1.5 text-[10px] tabular-nums"
									style={{ opacity: 0.7 }}
								>
									{statusCounts[s]}
								</span>
							)}
						</button>
					))}
				</div>

				{/* SLA range */}
				<div
					className="flex items-center gap-1 px-1 rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					{(["24h", "7d", "30d"] as const).map((r) => (
						<button
							key={r}
							type="button"
							onClick={() => setSlaRange(r)}
							className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
							style={
								slaRange === r
									? {
											background: "var(--color-teal-subtle)",
											color: "var(--color-teal)",
										}
									: { color: "var(--text-muted)" }
							}
						>
							{r}
						</button>
					))}
				</div>

				{/* View toggle */}
				<div
					className="flex items-center gap-0.5 px-1 rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<button
						type="button"
						onClick={() => setViewMode("grid")}
						className="p-1.5 rounded-md transition-all"
						style={
							viewMode === "grid"
								? {
										background: "var(--color-teal-subtle)",
										color: "var(--color-teal)",
									}
								: { color: "var(--text-faint)" }
						}
					>
						<LayoutGrid className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={() => setViewMode("list")}
						className="p-1.5 rounded-md transition-all"
						style={
							viewMode === "list"
								? {
										background: "var(--color-teal-subtle)",
										color: "var(--color-teal)",
									}
								: { color: "var(--text-faint)" }
						}
					>
						<List className="w-4 h-4" />
					</button>
				</div>
			</motion.div>

			{/* Content */}
			{isLoading ? (
				<div
					className={
						viewMode === "grid"
							? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
							: "space-y-2"
					}
				>
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Card
							key={i}
							className="p-4 animate-pulse"
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
						</Card>
					))}
				</div>
			) : filtered.length === 0 ? (
				<Card
					className="p-12 text-center"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
						style={{ background: "var(--surface-sunken)" }}
					>
						<Server
							className="w-6 h-6"
							style={{ color: "var(--text-faint)" }}
						/>
					</div>
					<p
						className="text-sm font-medium mb-1"
						style={{ color: "var(--text-secondary)" }}
					>
						{services.length === 0
							? "Henüz servis eklenmedi"
							: "Filtreye uygun servis bulunamadı"}
					</p>
					<p className="text-xs" style={{ color: "var(--text-faint)" }}>
						{services.length === 0
							? '"Servis Ekle" butonu ile başlayın'
							: "Arama veya filtre kriterlerini değiştirin"}
					</p>
				</Card>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
					<AnimatePresence mode="popLayout">
						{filtered.map((service, index) => {
							const sv = statusStyles(service.status);
							const uptime = uptimeMap[service.id];
							return (
								<motion.div
									key={service.id}
									initial={{ opacity: 0, scale: 0.97 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.97 }}
									transition={{ duration: 0.2, delay: index * 0.03 }}
									whileHover={{ y: -1 }}
									layout
								>
									<Link
										to={`/app/services/${service.id}`}
										className="block group"
									>
										<Card
											className="relative p-4 transition-all duration-150 overflow-hidden"
											style={{
												background: "var(--surface-card)",
												border: "1px solid var(--border-default)",
											}}
										>
											{/* Top status accent */}
											<div
												className="absolute inset-x-0 top-0 h-0.5"
												style={{ background: sv.accent }}
											/>

											<div className="flex items-start justify-between mb-3">
												<div className="flex items-center gap-3 min-w-0">
													<div
														className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative"
														style={{
															background: sv.badgeBg,
															border: `1px solid ${sv.accent}`,
														}}
													>
														<Server
															className="w-4 h-4"
															style={{ color: sv.dot }}
														/>
														<span
															className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
															style={{
																background: sv.dot,
																borderColor: "var(--surface-card)",
															}}
														/>
													</div>
													<div className="min-w-0">
														<h3
															className="text-sm font-semibold truncate"
															style={{ color: "var(--text-primary)" }}
														>
															{service.name}
														</h3>
														<p
															className="text-[11px] font-mono truncate mt-0.5"
															style={{ color: "var(--text-faint)" }}
														>
															{service.host}:{service.port}
														</p>
													</div>
												</div>
												<Badge
													className="text-[10px] px-2 py-0.5 shrink-0 rounded-md border-0"
													style={{
														background: sv.badgeBg,
														color: sv.badgeText,
													}}
												>
													{service.status === "up"
														? "Aktif"
														: service.status === "degraded"
															? "Bozuk"
															: service.status === "down"
																? "Çevrimdışı"
																: "Bilinmiyor"}
												</Badge>
											</div>

											<div
												className="flex items-center justify-between pt-3"
												style={{ borderTop: "1px solid var(--border-subtle)" }}
											>
												<div className="flex items-center gap-3">
													<span
														className="text-[11px] flex items-center gap-1"
														style={{ color: "var(--text-faint)" }}
													>
														<Clock className="w-3 h-3" />
														{service.poll_interval_sec}s
													</span>
													<span
														className="text-[11px] flex items-center gap-1 max-w-24 truncate"
														style={{ color: "var(--text-faint)" }}
													>
														<Globe className="w-3 h-3 shrink-0" />
														{service.health_endpoint}
													</span>
												</div>
												<div className="flex items-center gap-2">
													{uptime != null && (
														<span
															className="text-[11px] font-semibold tabular-nums font-mono"
															style={{
																color:
																	uptime >= 99
																		? "var(--status-up-text)"
																		: uptime >= 95
																			? "var(--status-warn-text)"
																			: "var(--status-down-text)",
															}}
														>
															{uptime.toFixed(1)}%
														</span>
													)}
													<ArrowUpRight
														className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
														style={{ color: "var(--text-faint)" }}
													/>
												</div>
											</div>
										</Card>
									</Link>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			) : (
				<Card
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<AnimatePresence mode="popLayout">
						{filtered.map((service, index) => {
							const sv = statusStyles(service.status);
							const uptime = uptimeMap[service.id];
							const isLast = index === filtered.length - 1;
							return (
								<motion.div
									key={service.id}
									initial={{ opacity: 0, x: -8 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -8 }}
									transition={{ duration: 0.2, delay: index * 0.02 }}
									layout
								>
									<Link
										to={`/app/services/${service.id}`}
										className="flex items-center gap-4 px-4 py-3 transition-colors group"
										style={{
											borderBottom: isLast
												? "none"
												: "1px solid var(--border-subtle)",
										}}
									>
										<span
											className="w-2 h-2 rounded-full shrink-0"
											style={{ background: sv.dot }}
										/>
										<span
											className="flex-1 text-sm font-medium truncate"
											style={{ color: "var(--text-secondary)" }}
										>
											{service.name}
										</span>
										<span
											className="text-xs font-mono hidden sm:block"
											style={{ color: "var(--text-faint)" }}
										>
											{service.host}:{service.port}
										</span>
										<span
											className="hidden sm:flex items-center gap-1 text-xs"
											style={{ color: "var(--text-faint)" }}
										>
											<Clock className="w-3 h-3" />
											{service.poll_interval_sec}s
										</span>
										{uptime != null && (
											<span
												className="text-xs font-semibold tabular-nums font-mono"
												style={{
													color:
														uptime >= 99
															? "var(--status-up-text)"
															: uptime >= 95
																? "var(--status-warn-text)"
																: "var(--status-down-text)",
												}}
											>
												{uptime.toFixed(1)}%
											</span>
										)}
										<Badge
											className="text-[10px] px-2 py-0.5 rounded-md border-0 shrink-0"
											style={{
												background: sv.badgeBg,
												color: sv.badgeText,
											}}
										>
											{service.status === "up"
												? "Aktif"
												: service.status === "degraded"
													? "Bozuk"
													: service.status === "down"
														? "Çevrimdışı"
														: "Bilinmiyor"}
										</Badge>
										<StatusIcon status={service.status} />
									</Link>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</Card>
			)}
		</div>
	);
}
