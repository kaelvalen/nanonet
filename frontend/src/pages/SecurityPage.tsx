import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	Clock,
	Loader2,
	RefreshCw,
	ScanLine,
	Shield,
	ShieldAlert,
	ShieldCheck,
	ShieldOff,
	Sparkles,
	XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import apiClient from "@/api/client";
import {
	type SecurityFinding,
	type SecurityScan,
	type ServiceScanSummary,
	securityApi,
} from "@/api/security";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

function scoreColor(score: number) {
	if (score >= 80) return "var(--status-up)";
	if (score >= 60) return "var(--status-degraded)";
	return "var(--status-down)";
}

function scoreLabel(score: number) {
	if (score >= 80) return "İyi";
	if (score >= 60) return "Dikkat";
	return "Kritik";
}

function severityStyle(severity: SecurityFinding["severity"]) {
	switch (severity) {
		case "critical":
			return {
				bg: "var(--status-down-subtle)",
				color: "var(--status-down-text)",
				label: "Kritik",
			};
		case "high":
			return {
				bg: "var(--status-down-subtle)",
				color: "var(--status-down-text)",
				label: "Yüksek",
			};
		case "medium":
			return {
				bg: "var(--status-degraded-subtle)",
				color: "var(--status-degraded-text)",
				label: "Orta",
			};
		default:
			return {
				bg: "var(--surface-sunken)",
				color: "var(--text-tertiary)",
				label: "Düşük",
			};
	}
}

function StatTile({
	label,
	value,
	sub,
	icon: Icon,
	accent,
}: {
	label: string;
	value: string | number;
	sub?: string;
	icon: React.ElementType;
	accent?: string;
}) {
	return (
		<div
			className="relative rounded-[6px] p-4"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: accent ?? "var(--border-strong)" }}
			/>
			<div className="flex items-center gap-1.5 pl-2">
				<Icon
					className="w-3.5 h-3.5"
					style={{ color: "var(--text-tertiary)" }}
				/>
				<span
					className="text-[11px] font-medium uppercase tracking-wider"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</span>
			</div>
			<p
				className="mt-2 pl-2 text-[24px] font-semibold leading-none tnum"
				style={{ color: accent ?? "var(--text-primary)" }}
			>
				{value}
			</p>
			{sub && (
				<p
					className="mt-1.5 pl-2 text-[11px]"
					style={{ color: "var(--text-faint)" }}
				>
					{sub}
				</p>
			)}
		</div>
	);
}

function TLSBadge({ scan }: { scan?: SecurityScan }) {
	if (!scan)
		return (
			<span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
				—
			</span>
		);
	if (!scan.tls_enabled)
		return (
			<span
				className="inline-flex items-center gap-1 text-[11px]"
				style={{ color: "var(--text-tertiary)" }}
			>
				<ShieldOff className="w-3 h-3" /> HTTP
			</span>
		);
	if (!scan.tls_valid)
		return (
			<span
				className="inline-flex items-center gap-1 text-[11px] font-medium"
				style={{ color: "var(--status-down-text)" }}
			>
				<XCircle className="w-3 h-3" /> Geçersiz
			</span>
		);
	const days = scan.tls_days_left ?? 999;
	if (days < 7)
		return (
			<span
				className="inline-flex items-center gap-1 text-[11px] font-medium tnum"
				style={{ color: "var(--status-down-text)" }}
			>
				<AlertCircle className="w-3 h-3" /> {days}g
			</span>
		);
	if (days < 30)
		return (
			<span
				className="inline-flex items-center gap-1 text-[11px] font-medium tnum"
				style={{ color: "var(--status-degraded-text)" }}
			>
				<AlertTriangle className="w-3 h-3" /> {days}g
			</span>
		);
	return (
		<span
			className="inline-flex items-center gap-1 text-[11px]"
			style={{ color: "var(--status-up-text)" }}
		>
			<ShieldCheck className="w-3 h-3" /> {scan.tls_version || "TLS"}
		</span>
	);
}

function ServiceRow({
	summary,
	onScan,
	scanning,
}: {
	summary: ServiceScanSummary;
	onScan: () => void;
	scanning: boolean;
}) {
	const [open, setOpen] = useState(false);
	const scan = summary.latest_scan;
	const findings: SecurityFinding[] = scan?.findings ?? [];
	const score = scan?.risk_score ?? null;

	return (
		<div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
			<div
				className="grid items-center gap-2 px-4 py-3"
				style={{ gridTemplateColumns: "1fr 90px 60px 60px 64px" }}
			>
				<button
					type="button"
					className="min-w-0 text-left disabled:cursor-default"
					onClick={() => findings.length > 0 && setOpen((v) => !v)}
					disabled={findings.length === 0}
				>
					<p
						className="font-medium truncate text-[13px]"
						style={{ color: "var(--text-primary)" }}
					>
						{summary.service_name}
					</p>
					<p
						className="text-[11px] truncate font-mono tnum"
						style={{ color: "var(--text-faint)" }}
					>
						{summary.service_host}:{summary.service_port}
					</p>
				</button>

				<TLSBadge scan={scan} />

				<div className="text-center">
					{scan ? (
						<span
							className="text-[12px] font-semibold tnum"
							style={{
								color:
									(scan.missing_headers?.length ?? 0) > 0
										? "var(--status-degraded-text)"
										: "var(--status-up-text)",
							}}
						>
							{scan.missing_headers?.length ?? 0}
						</span>
					) : (
						<span
							className="text-[11px]"
							style={{ color: "var(--text-faint)" }}
						>
							—
						</span>
					)}
				</div>

				<div className="text-center">
					{score !== null ? (
						<span
							className="text-[14px] font-semibold tnum"
							style={{ color: scoreColor(score) }}
						>
							{Math.round(score)}
						</span>
					) : (
						<span
							className="text-[11px]"
							style={{ color: "var(--text-faint)" }}
						>
							—
						</span>
					)}
				</div>

				<div className="flex items-center gap-0.5 justify-end">
					<Button
						variant="ghost"
						size="icon"
						onClick={onScan}
						disabled={scanning}
						aria-label="Tara"
						title="Tara"
					>
						{scanning ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<ScanLine className="w-3.5 h-3.5" />
						)}
					</Button>
					{findings.length > 0 && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setOpen((v) => !v)}
							aria-label="Bulguları aç"
						>
							<ChevronDown
								className="w-3.5 h-3.5 transition-transform"
								style={{ transform: open ? "rotate(180deg)" : "none" }}
							/>
						</Button>
					)}
				</div>
			</div>

			<AnimatePresence>
				{open && findings.length > 0 && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18 }}
						style={{
							overflow: "hidden",
							background: "var(--surface-sunken)",
						}}
					>
						<div className="px-4 py-3 flex flex-col gap-1.5">
							{findings.map((f) => {
								const st = severityStyle(f.severity);
								return (
									<div
										key={`${f.type}-${f.description}`}
										className="flex items-start gap-2 text-[12px]"
									>
										<span
											className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider"
											style={{ background: st.bg, color: st.color }}
										>
											{st.label}
										</span>
										<span style={{ color: "var(--text-secondary)" }}>
											{f.description}
										</span>
									</div>
								);
							})}
							{scan?.server_header && (
								<p
									className="text-[10px] font-mono pt-1"
									style={{ color: "var(--text-faint)" }}
								>
									Server: {scan.server_header}
								</p>
							)}
							{scan?.scanned_at && (
								<p
									className="flex items-center gap-1 text-[10px] tnum"
									style={{ color: "var(--text-faint)" }}
								>
									<Clock className="w-2.5 h-2.5" />
									{new Date(scan.scanned_at).toLocaleString("tr-TR")}
								</p>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

interface AuditLog {
	ID?: string;
	id?: string;
	Action?: string;
	action?: string;
	IPAddress?: string | null;
	ip_address?: string | null;
	Status?: "success" | "failure" | "blocked";
	status?: "success" | "failure" | "blocked";
	CreatedAt?: string;
	created_at?: string;
}

function AuditRow({ log }: { log: AuditLog }) {
	const action = log.Action ?? log.action ?? "";
	const ip = log.IPAddress ?? log.ip_address ?? "";
	const status = log.Status ?? log.status ?? "success";
	const ts = log.CreatedAt ?? log.created_at ?? "";

	const dot =
		status === "blocked"
			? "var(--status-down)"
			: status === "failure"
				? "var(--status-degraded)"
				: "var(--status-up)";

	const statusLabel =
		status === "blocked" ? "Engel" : status === "failure" ? "Hata" : "Başarılı";

	return (
		<div
			className="flex items-center gap-3 px-4 py-2"
			style={{ borderBottom: "1px solid var(--border-subtle)" }}
		>
			<span
				className="w-1.5 h-1.5 rounded-full shrink-0"
				style={{ background: dot }}
			/>
			<span
				className="flex-1 text-[12px] font-mono truncate"
				style={{ color: "var(--text-secondary)" }}
			>
				{action}
			</span>
			{ip && (
				<span
					className="text-[10px] hidden sm:block tnum"
					style={{ color: "var(--text-faint)" }}
				>
					{ip}
				</span>
			)}
			<span className="text-[10px] shrink-0" style={{ color: dot }}>
				{statusLabel}
			</span>
			{ts && (
				<span
					className="text-[10px] shrink-0 hidden md:block tnum"
					style={{ color: "var(--text-faint)" }}
				>
					{new Date(ts).toLocaleTimeString("tr-TR", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			)}
		</div>
	);
}

export function SecurityPage() {
	const queryClient = useQueryClient();
	const [scanningIds, setScanningIds] = useState<Set<string>>(new Set());

	const {
		data: overview,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["security-overview"],
		queryFn: securityApi.getOverview,
		staleTime: 60_000,
		retry: 1,
	});

	const { data: auditLogs = [] } = useQuery<AuditLog[]>({
		queryKey: ["audit-logs-security"],
		queryFn: async () => {
			const res = await apiClient.get("/audit", { params: { limit: 50 } });
			return res.data.data?.logs ?? res.data.data ?? [];
		},
		staleTime: 30_000,
	});

	const triggerMutation = useMutation({
		mutationFn: (serviceId: string) => securityApi.triggerScan(serviceId),
		onMutate: (id) => setScanningIds((p) => new Set(p).add(id)),
		onSettled: (_, __, id) =>
			setScanningIds((p) => {
				const n = new Set(p);
				n.delete(id);
				return n;
			}),
		onSuccess: () => {
			toast.success("Tarama tamamlandı");
			queryClient.invalidateQueries({ queryKey: ["security-overview"] });
		},
		onError: () => toast.error("Tarama başarısız"),
	});

	const aiMutation = useMutation({
		mutationFn: async () => {
			const res = await apiClient.post(
				"/ai/report",
				{ time_range: "24h" },
				{ timeout: 90_000 },
			);
			return res.data.data?.report;
		},
		onSuccess: (r) => r?.headline && toast.info(r.headline, { duration: 8000 }),
		onError: () => toast.error("AI analizi başarısız"),
	});

	const services = overview?.services ?? [];
	const score = overview?.security_score ?? 0;
	const blockedCount = auditLogs.filter(
		(l) => (l.Status ?? l.status) === "blocked",
	).length;
	const failedCount = auditLogs.filter(
		(l) => (l.Status ?? l.status) === "failure",
	).length;
	const authLogs = auditLogs
		.filter((l) => (l.Action ?? l.action ?? "").startsWith("auth."))
		.slice(0, 15);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2
					className="w-5 h-5 animate-spin"
					style={{ color: "var(--text-faint)" }}
				/>
			</div>
		);
	}

	return (
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="Güvenlik"
				title="Güvenlik taraması"
				description="TLS durumu, açık portlar, header'lar ve risk skoru."
				meta={
					services.length > 0 ? (
						<span
							className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-[4px] font-medium uppercase tracking-wider"
							style={{
								background:
									score >= 80
										? "var(--status-up-subtle)"
										: score >= 60
											? "var(--status-degraded-subtle)"
											: "var(--status-down-subtle)",
								color:
									score >= 80
										? "var(--status-up-text)"
										: score >= 60
											? "var(--status-degraded-text)"
											: "var(--status-down-text)",
							}}
						>
							<Shield className="w-3 h-3" />
							{`Güvenlik ${scoreLabel(score)}`}
						</span>
					) : null
				}
				actions={
					<>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<RefreshCw className="w-3 h-3 mr-1.5" />
							Yenile
						</Button>
						<Button
							size="sm"
							onClick={() => aiMutation.mutate()}
							disabled={aiMutation.isPending}
						>
							{aiMutation.isPending ? (
								<Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
							) : (
								<Sparkles className="w-3 h-3 mr-1.5" />
							)}
							AI analizi
						</Button>
					</>
				}
			/>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
				<StatTile
					label="Güvenlik skoru"
					value={services.length > 0 ? Math.round(score) : "—"}
					sub={services.length > 0 ? scoreLabel(score) : "Henüz taranmadı"}
					icon={ShieldAlert}
					accent={services.length > 0 ? scoreColor(score) : undefined}
				/>
				<StatTile
					label="TLS uyarısı"
					value={overview?.tls_warnings ?? 0}
					sub="sertifika sorunu"
					icon={Shield}
					accent={
						(overview?.tls_warnings ?? 0) > 0
							? "var(--status-down)"
							: "var(--status-up)"
					}
				/>
				<StatTile
					label="Başlık sorunu"
					value={overview?.header_issues ?? 0}
					sub="eksik güvenlik başlığı"
					icon={ShieldOff}
					accent={
						(overview?.header_issues ?? 0) > 0
							? "var(--status-degraded)"
							: "var(--status-up)"
					}
				/>
				<StatTile
					label="Engellenen"
					value={blockedCount}
					sub={`${failedCount} başarısız · son 50 olay`}
					icon={XCircle}
					accent={
						blockedCount > 0 ? "var(--status-down)" : "var(--border-strong)"
					}
				/>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 -mx-2 px-2 pb-4">
				<div
					className="rounded-[6px] overflow-hidden"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="flex items-center gap-2 px-4 py-2.5"
						style={{ borderBottom: "1px solid var(--border-subtle)" }}
					>
						<ShieldCheck
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-tertiary)" }}
						/>
						<span
							className="text-[12px] font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							Servis güvenlik durumu
						</span>
						<span
							className="ml-auto text-[10px] px-1.5 py-0.5 rounded-[4px] tnum"
							style={{
								background: "var(--surface-sunken)",
								color: "var(--text-tertiary)",
							}}
						>
							{services.length} servis
						</span>
					</div>

					<div
						className="grid items-center gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider"
						style={{
							gridTemplateColumns: "1fr 90px 60px 60px 64px",
							color: "var(--text-faint)",
							borderBottom: "1px solid var(--border-subtle)",
						}}
					>
						<span>Servis</span>
						<span>TLS</span>
						<span className="text-center">Başlık</span>
						<span className="text-center">Skor</span>
						<span />
					</div>

					{services.length === 0 ? (
						<div
							className="flex flex-col items-center justify-center py-10 gap-2"
							style={{ color: "var(--text-tertiary)" }}
						>
							<Shield className="w-7 h-7" />
							<p className="text-[12px]">Henüz taranmış servis yok</p>
							<p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
								Tarama 6 saatte bir otomatik çalışır
							</p>
						</div>
					) : (
						services.map((s) => (
							<ServiceRow
								key={s.service_id}
								summary={s}
								onScan={() => triggerMutation.mutate(s.service_id)}
								scanning={scanningIds.has(s.service_id)}
							/>
						))
					)}
				</div>

				<AnimatePresence>
					{aiMutation.data && (
						<motion.div
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							className="relative rounded-[6px] p-4"
							style={{
								background: "var(--brand-primary-subtle)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--brand-primary)" }}
							/>
							<div className="flex items-center gap-2 pl-2">
								<Sparkles
									className="w-3.5 h-3.5"
									style={{ color: "var(--brand-primary)" }}
								/>
								<span
									className="text-[12px] font-semibold"
									style={{ color: "var(--brand-primary)" }}
								>
									AI güvenlik içgörüsü
								</span>
								{aiMutation.data.system_score && (
									<span
										className="ml-auto text-[10px] px-1.5 py-0.5 rounded-[4px] tnum"
										style={{
											background: "var(--surface-sunken)",
											color: "var(--text-tertiary)",
										}}
									>
										{aiMutation.data.system_score}
									</span>
								)}
							</div>
							<p
								className="mt-2 pl-2 text-[13px]"
								style={{ color: "var(--text-secondary)" }}
							>
								{aiMutation.data.headline}
							</p>
							{aiMutation.data.risk_forecast && (
								<p
									className="mt-1 pl-2 text-[11px]"
									style={{ color: "var(--text-tertiary)" }}
								>
									{aiMutation.data.risk_forecast}
								</p>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{authLogs.length > 0 && (
					<div
						className="rounded-[6px] overflow-hidden"
						style={{
							background: "var(--surface-base)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<div
							className="flex items-center gap-2 px-4 py-2.5"
							style={{ borderBottom: "1px solid var(--border-subtle)" }}
						>
							<CheckCircle2
								className="w-3.5 h-3.5"
								style={{ color: "var(--text-tertiary)" }}
							/>
							<span
								className="text-[12px] font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Son auth olayları
							</span>
							{(blockedCount > 0 || failedCount > 0) && (
								<span
									className="ml-auto text-[10px] px-1.5 py-0.5 rounded-[4px] tnum"
									style={{
										background: "var(--status-down-subtle)",
										color: "var(--status-down-text)",
									}}
								>
									{blockedCount} engel · {failedCount} hata
								</span>
							)}
						</div>
						{authLogs.map((log, i) => (
							<AuditRow key={log.ID ?? log.id ?? `log-${i}`} log={log} />
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}
