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
import { PageHeader, PageShell } from "@/components/ui/page-shell";

// ── Yardımcılar ────────────────────────────────────────────────────────────

function scoreColor(score: number) {
	if (score >= 80) return "var(--status-up)";
	if (score >= 60) return "var(--status-warn)";
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
				border: "var(--status-down-border)",
				label: "Kritik",
			};
		case "high":
			return {
				bg: "var(--status-warn-subtle)",
				color: "var(--status-warn-text)",
				border: "var(--status-warn-border)",
				label: "Yüksek",
			};
		case "medium":
			return {
				bg: "var(--status-warn-subtle)",
				color: "var(--status-warn-text)",
				border: "var(--status-warn-border)",
				label: "Orta",
			};
		default:
			return {
				bg: "var(--surface-sunken)",
				color: "var(--text-faint)",
				border: "var(--border-subtle)",
				label: "Düşük",
			};
	}
}

// ── Stat kartı ─────────────────────────────────────────────────────────────

function StatCard({
	label,
	value,
	sub,
	icon: Icon,
	color,
}: {
	label: string;
	value: string | number;
	sub?: string;
	icon: React.ElementType;
	color?: string;
}) {
	return (
		<div
			className="p-4 rounded-xl space-y-2"
			style={{
				background: "var(--surface-raised)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div className="flex items-center gap-2">
				<Icon
					className="w-3.5 h-3.5"
					style={{ color: color ?? "var(--text-faint)" }}
				/>
				<span
					className="text-[11px] font-medium uppercase tracking-wider"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</span>
			</div>
			<p
				className="text-2xl font-bold tabular-nums leading-none"
				style={{ color: color ?? "var(--text-primary)" }}
			>
				{value}
			</p>
			{sub && (
				<p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
					{sub}
				</p>
			)}
		</div>
	);
}

// ── TLS göstergesi ─────────────────────────────────────────────────────────

function TLSBadge({ scan }: { scan?: SecurityScan }) {
	if (!scan)
		return (
			<span className="text-xs" style={{ color: "var(--text-faint)" }}>
				—
			</span>
		);
	if (!scan.tls_enabled)
		return (
			<span
				className="inline-flex items-center gap-1 text-xs"
				style={{ color: "var(--text-faint)" }}
			>
				<ShieldOff className="w-3 h-3" /> HTTP
			</span>
		);
	if (!scan.tls_valid)
		return (
			<span
				className="inline-flex items-center gap-1 text-xs font-medium"
				style={{ color: "var(--status-down-text)" }}
			>
				<XCircle className="w-3 h-3" /> Geçersiz
			</span>
		);
	const days = scan.tls_days_left ?? 999;
	if (days < 7)
		return (
			<span
				className="inline-flex items-center gap-1 text-xs font-medium"
				style={{ color: "var(--status-down-text)" }}
			>
				<AlertCircle className="w-3 h-3" /> {days}g
			</span>
		);
	if (days < 30)
		return (
			<span
				className="inline-flex items-center gap-1 text-xs font-medium"
				style={{ color: "var(--status-warn-text)" }}
			>
				<AlertTriangle className="w-3 h-3" /> {days}g
			</span>
		);
	return (
		<span
			className="inline-flex items-center gap-1 text-xs"
			style={{ color: "var(--status-up-text)" }}
		>
			<ShieldCheck className="w-3 h-3" /> {scan.tls_version || "TLS"}
		</span>
	);
}

// ── Servis satırı ──────────────────────────────────────────────────────────

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
			{/* Satır */}
			<div
				className="grid items-center gap-2 px-4 py-3 text-sm"
				style={{
					gridTemplateColumns: "1fr 90px 60px 56px 36px",
				}}
			>
				{/* Ad / host */}
				<button
					type="button"
					className="min-w-0 text-left"
					onClick={() => findings.length > 0 && setOpen((v) => !v)}
					disabled={findings.length === 0}
				>
					<p
						className="font-medium truncate text-xs"
						style={{ color: "var(--text-primary)" }}
					>
						{summary.service_name}
					</p>
					<p
						className="text-[10px] truncate font-mono"
						style={{ color: "var(--text-faint)" }}
					>
						{summary.service_host}:{summary.service_port}
					</p>
				</button>

				{/* TLS */}
				<div>
					<TLSBadge scan={scan} />
				</div>

				{/* Eksik başlık */}
				<div className="text-center">
					{scan ? (
						<span
							className="text-xs font-semibold tabular-nums"
							style={{
								color:
									(scan.missing_headers?.length ?? 0) > 0
										? "var(--status-warn-text)"
										: "var(--status-up-text)",
							}}
						>
							{scan.missing_headers?.length ?? 0}
						</span>
					) : (
						<span style={{ color: "var(--text-faint)", fontSize: 11 }}>—</span>
					)}
				</div>

				{/* Skor */}
				<div className="text-center">
					{score !== null ? (
						<span
							className="text-sm font-bold tabular-nums"
							style={{ color: scoreColor(score) }}
						>
							{Math.round(score)}
						</span>
					) : (
						<span
							className="text-[10px]"
							style={{ color: "var(--text-faint)" }}
						>
							Yok
						</span>
					)}
				</div>

				{/* Tarama + aç */}
				<div className="flex items-center gap-0.5 justify-end">
					<button
						type="button"
						onClick={onScan}
						disabled={scanning}
						className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
						style={{ color: "var(--text-faint)" }}
						title="Tara"
					>
						{scanning ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<ScanLine className="w-3.5 h-3.5" />
						)}
					</button>
					{findings.length > 0 && (
						<button
							type="button"
							onClick={() => setOpen((v) => !v)}
							className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
							style={{ color: "var(--text-faint)" }}
						>
							<ChevronDown
								className="w-3.5 h-3.5 transition-transform"
								style={{ transform: open ? "rotate(180deg)" : "none" }}
							/>
						</button>
					)}
				</div>
			</div>

			{/* Bulgular */}
			<AnimatePresence>
				{open && findings.length > 0 && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18 }}
						style={{ overflow: "hidden", background: "var(--surface-sunken)" }}
					>
						<div className="px-4 py-2.5 space-y-1.5">
							{findings.map((f) => {
								const st = severityStyle(f.severity);
								return (
									<div
										key={`${f.type}-${f.description}`}
										className="flex items-start gap-2 text-xs"
									>
										<span
											className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
											style={{
												background: st.bg,
												color: st.color,
												border: `1px solid ${st.border}`,
											}}
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
									className="flex items-center gap-1 text-[10px] pt-0.5"
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

// ── Audit olayları ─────────────────────────────────────────────────────────

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
				? "var(--status-warn)"
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
				className="flex-1 text-xs font-mono truncate"
				style={{ color: "var(--text-secondary)" }}
			>
				{action}
			</span>
			{ip && (
				<span
					className="text-[10px] hidden sm:block"
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
					className="text-[10px] shrink-0 hidden md:block tabular-nums"
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

// ── Ana sayfa ──────────────────────────────────────────────────────────────

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
		<PageShell width="wide">
			<PageHeader
				eyebrow="Güvenlik"
				title="Güvenlik Taraması"
				description="TLS durumu, açık port'lar, header'lar ve risk skoru"
				meta={
					services.length > 0 ? (
						<span
							className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold"
							style={{
								background:
									score >= 80
										? "var(--status-up-subtle)"
										: score >= 60
											? "var(--status-warn-subtle)"
											: "var(--status-down-subtle)",
								color:
									score >= 80
										? "var(--status-up-text)"
										: score >= 60
											? "var(--status-warn-text)"
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
						<button
							type="button"
							onClick={() => refetch()}
							className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors"
							style={{
								background: "var(--surface-raised)",
								color: "var(--text-muted)",
								border: "1px solid var(--border-default)",
							}}
						>
							<RefreshCw className="w-3 h-3" />
							Yenile
						</button>
						<button
							type="button"
							onClick={() => aiMutation.mutate()}
							disabled={aiMutation.isPending}
							className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors"
							style={{
								background: "var(--color-ai-subtle)",
								color: "var(--color-ai)",
								border: "1px solid var(--color-ai-border)",
							}}
						>
							{aiMutation.isPending ? (
								<Loader2 className="w-3 h-3 animate-spin" />
							) : (
								<Sparkles className="w-3 h-3" />
							)}
							AI Analizi
						</button>
					</>
				}
			/>

			{/* ── Stat kartları ────────────────────────────────────────── */}
			<motion.div
				className="grid grid-cols-2 sm:grid-cols-4 gap-3"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.05 }}
			>
				<StatCard
					label="Güvenlik Skoru"
					value={services.length > 0 ? Math.round(score) : "—"}
					sub={services.length > 0 ? scoreLabel(score) : "Henüz taranmadı"}
					icon={ShieldAlert}
					color={services.length > 0 ? scoreColor(score) : undefined}
				/>
				<StatCard
					label="TLS Uyarısı"
					value={overview?.tls_warnings ?? 0}
					sub="sertifika sorunu"
					icon={Shield}
					color={
						(overview?.tls_warnings ?? 0) > 0
							? "var(--status-down)"
							: "var(--status-up)"
					}
				/>
				<StatCard
					label="Başlık Sorunu"
					value={overview?.header_issues ?? 0}
					sub="eksik güvenlik başlığı"
					icon={ShieldOff}
					color={
						(overview?.header_issues ?? 0) > 0
							? "var(--status-warn)"
							: "var(--status-up)"
					}
				/>
				<StatCard
					label="Engellenen"
					value={blockedCount}
					sub={`${failedCount} başarısız · son 50 olay`}
					icon={XCircle}
					color={blockedCount > 0 ? "var(--status-down)" : "var(--text-faint)"}
				/>
			</motion.div>

			{/* ── Servis tablosu ───────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.1 }}
				className="rounded-xl overflow-hidden"
				style={{
					background: "var(--surface-raised)",
					border: "1px solid var(--border-default)",
				}}
			>
				{/* Tablo başlığı */}
				<div
					className="flex items-center gap-2 px-4 py-3"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					<ShieldCheck
						className="w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<span
						className="text-xs font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						Servis Güvenlik Durumu
					</span>
					<span
						className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
						style={{
							background: "var(--surface-sunken)",
							color: "var(--text-faint)",
						}}
					>
						{services.length} servis
					</span>
				</div>

				{/* Kolon başlıkları */}
				<div
					className="grid items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
					style={{
						gridTemplateColumns: "1fr 90px 60px 56px 36px",
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
						style={{ color: "var(--text-faint)" }}
					>
						<Shield className="w-7 h-7" />
						<p className="text-xs">Henüz taranmış servis yok</p>
						<p className="text-[11px]">Tarama 6 saatte bir otomatik çalışır</p>
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
			</motion.div>

			{/* ── AI sonucu ────────────────────────────────────────────── */}
			<AnimatePresence>
				{aiMutation.data && (
					<motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						className="rounded-xl p-4 space-y-1.5"
						style={{
							background: "var(--color-ai-subtle)",
							border: "1px solid var(--color-ai-border)",
						}}
					>
						<div className="flex items-center gap-2">
							<Sparkles
								className="w-3.5 h-3.5"
								style={{ color: "var(--color-ai)" }}
							/>
							<span
								className="text-xs font-semibold"
								style={{ color: "var(--color-ai)" }}
							>
								AI Güvenlik İçgörüsü
							</span>
							{aiMutation.data.system_score && (
								<span
									className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
									style={{
										background: "var(--surface-sunken)",
										color: "var(--text-faint)",
									}}
								>
									{aiMutation.data.system_score}
								</span>
							)}
						</div>
						<p className="text-xs" style={{ color: "var(--text-secondary)" }}>
							{aiMutation.data.headline}
						</p>
						{aiMutation.data.risk_forecast && (
							<p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
								{aiMutation.data.risk_forecast}
							</p>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Auth olayları ─────────────────────────────────────────── */}
			{authLogs.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.15 }}
					className="rounded-xl overflow-hidden"
					style={{
						background: "var(--surface-raised)",
						border: "1px solid var(--border-default)",
					}}
				>
					<div
						className="flex items-center gap-2 px-4 py-3"
						style={{ borderBottom: "1px solid var(--border-default)" }}
					>
						<CheckCircle2
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-faint)" }}
						/>
						<span
							className="text-xs font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							Son Auth Olayları
						</span>
						{(blockedCount > 0 || failedCount > 0) && (
							<span
								className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
								style={{
									background: "var(--status-down-subtle)",
									color: "var(--status-down-text)",
									border: "1px solid var(--status-down-border)",
								}}
							>
								{blockedCount} engel · {failedCount} hata
							</span>
						)}
					</div>
					{authLogs.map((log, i) => (
						<AuditRow key={log.ID ?? log.id ?? i} log={log} />
					))}
				</motion.div>
			)}
		</PageShell>
	);
}
