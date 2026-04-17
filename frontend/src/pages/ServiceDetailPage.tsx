import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	ArrowLeft,
	Bell,
	CalendarClock,
	CheckCircle2,
	Clock,
	Cpu,
	Eye,
	HardDrive,
	History,
	Layers,
	Loader2,
	Play,
	Power,
	RefreshCw,
	Send,
	Server,
	Shield,
	Sparkles,
	Terminal,
	Trash2,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import { type AnalysisResult, metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { AgentSetupWizard } from "@/components/AgentSetupWizard";
import { LogViewer } from "@/components/LogViewer";
import { AlertRulesTab } from "@/components/service-detail/AlertRulesTab";
import { CommandHistoryTab } from "@/components/service-detail/CommandHistoryTab";
import { LoadBalancingTab } from "@/components/service-detail/LoadBalancingTab";
import { MaintenanceTab } from "@/components/service-detail/MaintenanceTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServices } from "@/hooks/useServices";

type ExecEntry = {
	command: string;
	command_id: string;
	status: "queued" | "received" | "success" | "failed" | "timeout";
	queued_at: string;
	output?: string;
	error?: string;
	duration_ms?: number;
};

export function ServiceDetailPage() {
	const { serviceId } = useParams<{ serviceId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { deleteService, restartService, stopService } = useServices();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [analyzeLoading, setAnalyzeLoading] = useState(false);
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null,
	);
	const [deepAnalysis, setDeepAnalysis] = useState(false);
	const [metricsDuration, setMetricsDuration] = useState("1h");
	const [execCommand, setExecCommand] = useState("");
	const [execLoading, setExecLoading] = useState(false);
	const [execHistory, setExecHistory] = useState<ExecEntry[]>([]);
	const [startLoading, setStartLoading] = useState(false);
	const [scaleInstances, setScaleInstances] = useState(1);
	const [scaleStrategy, setScaleStrategy] = useState<
		"round_robin" | "least_conn" | "ip_hash"
	>("round_robin");
	const [scaleLoading, setScaleLoading] = useState(false);
	const terminalEndRef = useRef<HTMLDivElement>(null);
	const [agentWizardOpen, setAgentWizardOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("metrics");
	const [execConfirmOpen, setExecConfirmOpen] = useState(false);
	const [pendingCommand, setPendingCommand] = useState("");
	const [execSessionConfirmed, setExecSessionConfirmed] = useState(
		() => sessionStorage.getItem("exec_session_confirmed") === "1",
	);
	const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
	const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

	const { data: service, isLoading: serviceLoading } = useQuery({
		queryKey: ["service", serviceId],
		queryFn: () => servicesApi.get(serviceId ?? ""),
		enabled: !!serviceId,
		refetchInterval: 5000,
	});

	const { data: metrics = [], isLoading: metricsLoading } = useQuery({
		queryKey: ["serviceMetrics", serviceId, metricsDuration],
		queryFn: () => metricsApi.getHistory(serviceId ?? "", metricsDuration),
		enabled: !!serviceId,
		refetchInterval: 30000,
	});

	const { data: uptime } = useQuery({
		queryKey: ["serviceUptime", serviceId],
		queryFn: () => metricsApi.getUptime(serviceId ?? "", "24h"),
		enabled: !!serviceId,
	});

	const { data: alerts = [] } = useQuery({
		queryKey: ["serviceAlerts", serviceId],
		queryFn: () => metricsApi.getAlerts(serviceId ?? "", false),
		enabled: !!serviceId,
	});

	const handleDelete = () => {
		if (serviceId) {
			deleteService(serviceId);
			setDeleteDialogOpen(false);
			navigate("/app/services");
		}
	};

	useEffect(() => {
		const handler = (e: Event) => {
			const ev = e as CustomEvent<{
				command_id: string;
				status: string;
				output?: string;
				error?: string;
				service_id?: string;
			}>;
			const { command_id, status, output, error } = ev.detail;
			setExecHistory((prev) =>
				prev.map((entry) =>
					entry.command_id === command_id
						? { ...entry, status: status as ExecEntry["status"], output, error }
						: entry,
				),
			);
		};
		window.addEventListener("nanonet:command_result", handler);
		return () => window.removeEventListener("nanonet:command_result", handler);
	}, []);

	useEffect(() => {
		terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const handleRestart = () => {
		if (serviceId) {
			restartService(serviceId);
			setRestartConfirmOpen(false);
		}
	};

	const handleStop = () => {
		if (serviceId) {
			stopService(serviceId);
			setStopConfirmOpen(false);
		}
	};

	const handleStart = async () => {
		if (!serviceId) return;
		setStartLoading(true);
		try {
			await servicesApi.start(serviceId);
			toast.success("Başlatma komutu gönderildi");
		} catch {
			toast.error("Başlatma komutu gönderilemedi");
		} finally {
			setStartLoading(false);
		}
	};

	const handleScale = async () => {
		if (!serviceId) return;
		setScaleLoading(true);
		try {
			await servicesApi.scale(serviceId, scaleInstances, scaleStrategy);
			toast.success(`Ölçekleme komutu gönderildi: ${scaleInstances} örnek`);
		} catch {
			toast.error("Ölçekleme komutu gönderilemedi");
		} finally {
			setScaleLoading(false);
		}
	};

	const handleExecRequest = () => {
		const cmd = execCommand.trim();
		if (!cmd) return;
		if (execSessionConfirmed) {
			void handleExecDirect(cmd);
		} else {
			setPendingCommand(cmd);
			setExecConfirmOpen(true);
		}
	};

	const handleExecDirect = async (cmd: string) => {
		if (!serviceId || !cmd) return;
		setExecLoading(true);
		setExecCommand("");
		try {
			const result = await servicesApi.exec(serviceId, cmd);
			setExecHistory((prev) => [
				...prev,
				{
					command: cmd,
					...result,
					status: result.status as ExecEntry["status"],
				},
			]);
		} catch {
			toast.error("Komut gönderilemedi");
		} finally {
			setExecLoading(false);
		}
	};

	const handleAnalyze = async () => {
		if (!serviceId) return;
		setAnalyzeLoading(true);
		try {
			const result = await metricsApi.analyze(serviceId, 30, deepAnalysis);
			setAnalysisResult(result);
		} catch {
			toast.error("AI analiz başarısız oldu");
		} finally {
			setAnalyzeLoading(false);
		}
	};

	const handleResolveAlert = async (alertId: string) => {
		try {
			await metricsApi.resolveAlert(alertId);
			toast.success("Alert çözüldü");
			queryClient.invalidateQueries({ queryKey: ["serviceAlerts", serviceId] });
		} catch {
			toast.error("Alert çözülemedi");
		}
	};

	const chartData = metrics.map((m) => ({
		time: new Date(m.time).toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		}),
		cpu: m.cpu_percent,
		memory: m.memory_used_mb,
		latency: m.latency_ms,
		error_rate: m.error_rate,
		disk: m.disk_used_gb,
	}));

	const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

	if (serviceLoading) {
		return (
			<div className="space-y-6">
				<div
					className="h-8 w-48 rounded animate-pulse"
					style={{ background: "var(--color-teal-subtle)" }}
				/>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card
							key={i}
							className="p-4 rounded animate-pulse"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						>
							<div
								className="h-4 w-20 rounded mb-2"
								style={{ background: "var(--color-teal-subtle)" }}
							/>
							<div
								className="h-6 w-16 rounded"
								style={{ background: "var(--color-teal-subtle)" }}
							/>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (!service) {
		return (
			<div className="text-center py-20">
				<Server
					className="w-16 h-16 mx-auto mb-4"
					style={{ color: "var(--text-faint)" }}
				/>
				<h2
					className="text-lg font-semibold"
					style={{ color: "var(--text-secondary)" }}
				>
					Servis bulunamadı
				</h2>
				<Link
					to="/app/services"
					className="text-sm hover:underline mt-2 inline-block"
					style={{ color: "var(--color-teal)" }}
				>
					← Servislere dön
				</Link>
			</div>
		);
	}

	const statusBadgeStyle: React.CSSProperties =
		service.status === "up"
			? {
					background: "var(--status-up-subtle)",
					color: "var(--status-up-text)",
					borderColor: "var(--status-up-border)",
				}
			: service.status === "degraded"
				? {
						background: "var(--status-warn-subtle)",
						color: "var(--status-warn-text)",
						borderColor: "var(--status-warn-border)",
					}
				: {
						background: "var(--status-down-subtle)",
						color: "var(--status-down-text)",
						borderColor: "var(--status-down-border)",
					};

	return (
		<PageShell width="wide" fill>
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
				className="pb-3 mb-4"
			>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => navigate("/app/services")}
						className="p-2 rounded-lg transition-colors hover:opacity-70"
						style={{
							color: "var(--text-muted)",
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-default)",
						}}
					>
						<ArrowLeft className="w-4 h-4" />
					</button>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3">
							<h1
								className="text-lg font-bold truncate"
								style={{ color: "var(--text-primary)" }}
							>
								{service?.name ?? ""}
							</h1>
							<Badge
								className="text-[10px] font-mono px-2 py-0.5 rounded border"
								style={statusBadgeStyle}
							>
								{service?.status?.toUpperCase() ?? "UNKNOWN"}
							</Badge>
						</div>
						<p
							className="text-xs font-mono mt-0.5"
							style={{ color: "var(--text-faint)" }}
						>
							{service?.host}:{service?.port} · {service?.health_endpoint} ·{" "}
							{service?.poll_interval_sec}s poll
						</p>
					</div>
					<div className="flex items-center gap-1.5 flex-wrap justify-end">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setAgentWizardOpen(true)}
							className="rounded text-xs h-8 hidden sm:flex"
							style={{
								borderColor: "var(--color-blue-border)",
								color: "var(--color-blue)",
							}}
						>
							<Zap className="w-3 h-3 mr-1" /> Agent Kur
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleStart}
							disabled={startLoading}
							className="rounded text-xs h-8"
							style={{
								borderColor: "var(--status-up-border)",
								color: "var(--status-up-text)",
							}}
						>
							{startLoading ? (
								<Loader2 className="w-3 h-3 sm:mr-1 animate-spin" />
							) : (
								<Play className="w-3 h-3 sm:mr-1" />
							)}
							<span className="hidden sm:inline">Başlat</span>
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setRestartConfirmOpen(true)}
							className="rounded text-xs h-8"
							style={{
								borderColor: "var(--color-teal-border)",
								color: "var(--color-teal)",
							}}
						>
							<RefreshCw className="w-3 h-3 sm:mr-1" />
							<span className="hidden sm:inline">Yeniden Başlat</span>
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setStopConfirmOpen(true)}
							className="rounded text-xs h-8"
							style={{
								borderColor: "var(--status-warn-border)",
								color: "var(--status-warn-text)",
							}}
						>
							<Power className="w-3 h-3 sm:mr-1" />
							<span className="hidden sm:inline">Durdur</span>
						</Button>
						<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="rounded text-xs h-8"
									aria-label="Servisi sil"
									style={{
										borderColor: "var(--status-down-border)",
										color: "var(--status-down-text)",
									}}
								>
									<Trash2 className="w-3 h-3" />
								</Button>
							</DialogTrigger>
							<DialogContent
								className="rounded"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--status-down-border)",
									boxShadow: "var(--panel-shadow)",
								}}
							>
								<DialogHeader>
									<DialogTitle style={{ color: "var(--status-down-text)" }}>
										Servisi Sil
									</DialogTitle>
									<DialogDescription style={{ color: "var(--text-muted)" }}>
										<strong>{service?.name}</strong> servisini silmek
										istediğinize emin misiniz? Bu işlem geri alınamaz.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setDeleteDialogOpen(false)}
										className="rounded"
									>
										İptal
									</Button>
									<Button
										onClick={handleDelete}
										className="text-white rounded"
										style={{ background: "var(--status-down-text)" }}
									>
										Sil
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						<Dialog
							open={restartConfirmOpen}
							onOpenChange={setRestartConfirmOpen}
						>
							<DialogContent
								className="rounded max-w-sm"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--color-teal-border)",
									boxShadow: "var(--panel-shadow)",
								}}
							>
								<DialogHeader>
									<DialogTitle style={{ color: "var(--color-teal)" }}>
										Yeniden Başlat
									</DialogTitle>
									<DialogDescription style={{ color: "var(--text-muted)" }}>
										<strong style={{ color: "var(--text-secondary)" }}>
											{service?.name}
										</strong>{" "}
										servisi yeniden başlatılacak. Aktif bağlantılar
										kesilecektir. Devam etmek istiyor musunuz?
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setRestartConfirmOpen(false)}
										className="rounded text-xs"
									>
										İptal
									</Button>
									<Button
										onClick={handleRestart}
										className="rounded text-xs"
										style={{ background: "var(--color-teal)", color: "white" }}
									>
										<RefreshCw className="w-3 h-3 mr-1" /> Yeniden Başlat
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						<Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
							<DialogContent
								className="rounded max-w-sm"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--status-warn-border)",
									boxShadow: "var(--panel-shadow)",
								}}
							>
								<DialogHeader>
									<DialogTitle style={{ color: "var(--status-warn-text)" }}>
										Servisi Durdur
									</DialogTitle>
									<DialogDescription style={{ color: "var(--text-muted)" }}>
										<strong style={{ color: "var(--text-secondary)" }}>
											{service?.name}
										</strong>{" "}
										durdurulacak. Servis yanıt vermez hale gelecektir. Devam
										etmek istiyor musunuz?
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setStopConfirmOpen(false)}
										className="rounded text-xs"
									>
										İptal
									</Button>
									<Button
										onClick={handleStop}
										className="rounded text-xs"
										style={{ background: "var(--status-warn)", color: "white" }}
									>
										<Power className="w-3 h-3 mr-1" /> Durdur
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</motion.div>

			{/* Quick Stats Row */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.1 }}
			>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					{/* CPU */}
					<Card
						className="p-4 rounded overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--color-teal-border)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-1.5">
								<Cpu
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-teal)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									CPU
								</span>
							</div>
							{latestMetric && (
								<span
									className="text-[10px] font-medium"
									style={{
										color:
											(latestMetric.cpu_percent ?? 0) > 80
												? "var(--status-down-text)"
												: (latestMetric.cpu_percent ?? 0) > 60
													? "var(--status-warn-text)"
													: "var(--status-up-text)",
									}}
								>
									{(latestMetric.cpu_percent ?? 0) > 80
										? "Yüksek"
										: (latestMetric.cpu_percent ?? 0) > 60
											? "Orta"
											: "İyi"}
								</span>
							)}
						</div>
						<p
							className="text-xl font-bold mb-2"
							style={{ color: "var(--text-secondary)" }}
						>
							{latestMetric ? `${latestMetric.cpu_percent?.toFixed(1)}%` : "—"}
						</p>
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<motion.div
								className="h-full rounded-full"
								style={{
									backgroundColor: !latestMetric
										? undefined
										: (latestMetric.cpu_percent ?? 0) > 80
											? "var(--status-down)"
											: (latestMetric.cpu_percent ?? 0) > 60
												? "var(--status-warn)"
												: "var(--color-teal)",
								}}
								initial={{ width: 0 }}
								animate={{
									width: latestMetric
										? `${Math.min(latestMetric.cpu_percent ?? 0, 100)}%`
										: "0%",
								}}
								transition={{ duration: 0.7, delay: 0.2 }}
							/>
						</div>
					</Card>
					{/* Memory */}
					<Card
						className="p-4 rounded overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--color-blue-border)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-1.5">
								<HardDrive
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-blue)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									Bellek
								</span>
							</div>
						</div>
						<p
							className="text-xl font-bold mb-2"
							style={{ color: "var(--text-secondary)" }}
						>
							{latestMetric
								? `${latestMetric.memory_used_mb?.toFixed(0)} MB`
								: "—"}
						</p>
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<motion.div
								className="h-full rounded-full"
								style={{ backgroundColor: "var(--color-blue)" }}
								initial={{ width: 0 }}
								animate={{
									width: latestMetric
										? `${Math.min(((latestMetric.memory_used_mb ?? 0) / 4096) * 100, 100)}%`
										: "0%",
								}}
								transition={{ duration: 0.7, delay: 0.25 }}
							/>
						</div>
					</Card>
					{/* Latency */}
					<Card
						className="p-4 rounded overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--color-lavender-border)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-1.5">
								<Zap
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-lavender)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									Gecikme
								</span>
							</div>
							{latestMetric && (
								<span
									className="text-[10px] font-medium"
									style={{
										color:
											(latestMetric.latency_ms ?? 0) > 500
												? "var(--status-down-text)"
												: (latestMetric.latency_ms ?? 0) > 200
													? "var(--status-warn-text)"
													: "var(--status-up-text)",
									}}
								>
									{(latestMetric.latency_ms ?? 0) > 500
										? "Yavaş"
										: (latestMetric.latency_ms ?? 0) > 200
											? "Orta"
											: "Hızlı"}
								</span>
							)}
						</div>
						<p
							className="text-xl font-bold mb-2"
							style={{ color: "var(--text-secondary)" }}
						>
							{latestMetric ? `${latestMetric.latency_ms?.toFixed(0)} ms` : "—"}
						</p>
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<motion.div
								className="h-full rounded-full"
								style={{
									backgroundColor: !latestMetric
										? undefined
										: (latestMetric.latency_ms ?? 0) > 500
											? "var(--status-down)"
											: (latestMetric.latency_ms ?? 0) > 200
												? "var(--status-warn)"
												: "var(--color-lavender)",
								}}
								initial={{ width: 0 }}
								animate={{
									width: latestMetric
										? `${Math.min(((latestMetric.latency_ms ?? 0) / 1000) * 100, 100)}%`
										: "0%",
								}}
								transition={{ duration: 0.7, delay: 0.3 }}
							/>
						</div>
					</Card>
					{/* Uptime */}
					<Card
						className="p-4 rounded overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--status-up-border)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-1.5">
								<Shield
									className="w-3.5 h-3.5"
									style={{ color: "var(--status-up)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									Çalışma Süresi
								</span>
							</div>
						</div>
						<p
							className="text-xl font-bold mb-2"
							style={{ color: "var(--text-secondary)" }}
						>
							{uptime ? `${uptime.uptime_percent.toFixed(1)}%` : "—"}
						</p>
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<motion.div
								className="h-full rounded-full"
								style={{
									backgroundColor: !uptime
										? undefined
										: uptime.uptime_percent >= 99
											? "var(--status-up)"
											: uptime.uptime_percent >= 95
												? "var(--status-warn)"
												: "var(--status-down)",
								}}
								initial={{ width: 0 }}
								animate={{ width: uptime ? `${uptime.uptime_percent}%` : "0%" }}
								transition={{ duration: 0.8, delay: 0.35 }}
							/>
						</div>
					</Card>
				</div>
			</motion.div>

			{/* Tabs: Charts, Alerts, AI */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.2 }}
			>
				<Tabs
					defaultValue="metrics"
					className="space-y-4"
					onValueChange={setActiveTab}
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
						<TabsList
							className="rounded p-1 overflow-x-auto w-full sm:w-auto h-auto flex-wrap sm:flex-nowrap"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						>
							<TabsTrigger value="metrics" className="rounded text-xs">
								<TrendingUp className="w-3 h-3 mr-1" /> Metrikler
							</TabsTrigger>
							<TabsTrigger value="alerts" className="rounded text-xs">
								<AlertCircle className="w-3 h-3 mr-1" /> Uyarılar (
								{alerts.length})
							</TabsTrigger>
							<TabsTrigger value="ai" className="rounded text-xs">
								<Sparkles className="w-3 h-3 mr-1" /> AI Analiz
							</TabsTrigger>
							<TabsTrigger value="terminal" className="rounded text-xs">
								<Terminal className="w-3 h-3 mr-1" /> Terminal
							</TabsTrigger>
							<TabsTrigger value="scale" className="rounded text-xs">
								<Layers className="w-3 h-3 mr-1" /> Orkestrasyon
							</TabsTrigger>
							<TabsTrigger value="history" className="rounded text-xs">
								<History className="w-3 h-3 mr-1" /> Geçmiş
							</TabsTrigger>
							<TabsTrigger value="alert-rules" className="rounded text-xs">
								<Bell className="w-3 h-3 mr-1" /> Uyarı Kuralları
							</TabsTrigger>
							<TabsTrigger value="maintenance" className="rounded text-xs">
								<CalendarClock className="w-3 h-3 mr-1" /> Bakım
							</TabsTrigger>
							<TabsTrigger value="logs" className="rounded text-xs">
								<Terminal className="w-3 h-3 mr-1" /> Günlükler
							</TabsTrigger>
						</TabsList>

						{/* Duration picker for metrics */}
						<div className="flex items-center gap-1">
							{["15m", "1h", "6h", "24h"].map((d) => (
								<button
									type="button"
									key={d}
									onClick={() => setMetricsDuration(d)}
									className="px-2 py-1 rounded text-[10px] font-medium transition-all border"
									style={
										metricsDuration === d
											? {
													background: "var(--color-teal-subtle)",
													color: "var(--color-teal)",
													borderColor: "var(--color-teal-border)",
												}
											: {
													color: "var(--text-muted)",
													borderColor: "transparent",
												}
									}
								>
									{d}
								</button>
							))}
						</div>
					</div>

					{/* Metrics Tab */}
					<TabsContent value="metrics" className="space-y-4">
						{metricsLoading ? (
							<Card
								className="p-8 rounded animate-pulse"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div
									className="h-64 rounded"
									style={{ background: "var(--color-teal-subtle)" }}
								/>
							</Card>
						) : chartData.length === 0 ? (
							<Card
								className="p-12 rounded text-center"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--color-teal-border)",
								}}
							>
								<Activity
									className="w-10 h-10 mx-auto mb-3"
									style={{ color: "var(--text-faint)" }}
								/>
								<p className="text-sm" style={{ color: "var(--text-muted)" }}>
									Bu zaman aralığında metrik verisi yok
								</p>
							</Card>
						) : (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{/* CPU Chart */}
								<Card
									className="p-4 rounded"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--color-teal-border)",
									}}
								>
									<h3
										className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
										style={{ color: "var(--text-muted)" }}
									>
										<Cpu
											className="w-3 h-3"
											style={{ color: "var(--color-teal)" }}
										/>{" "}
										CPU Kullanımı (%)
									</h3>
									<ResponsiveContainer width="100%" height={200}>
										<AreaChart data={chartData}>
											<defs>
												<linearGradient
													id="cpuGrad"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#39c5bb"
														stopOpacity={0.15}
													/>
													<stop
														offset="95%"
														stopColor="#39c5bb"
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis
												dataKey="time"
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
											/>
											<YAxis
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
												domain={[0, 100]}
											/>
											<Tooltip
												contentStyle={{
													borderRadius: 0,
													border: "1px solid #39c5bb",
													fontSize: 11,
												}}
											/>
											<Area
												type="monotone"
												dataKey="cpu"
												stroke="#39c5bb"
												fill="url(#cpuGrad)"
												strokeWidth={2}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</Card>

								{/* Memory Chart */}
								<Card
									className="p-4 rounded"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--color-blue-border)",
									}}
								>
									<h3
										className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
										style={{ color: "var(--text-muted)" }}
									>
										<HardDrive
											className="w-3 h-3"
											style={{ color: "var(--color-blue)" }}
										/>{" "}
										Bellek (MB)
									</h3>
									<ResponsiveContainer width="100%" height={200}>
										<AreaChart data={chartData}>
											<defs>
												<linearGradient
													id="memGrad"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#93c5fd"
														stopOpacity={0.15}
													/>
													<stop
														offset="95%"
														stopColor="#93c5fd"
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis
												dataKey="time"
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
											/>
											<YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
											<Tooltip
												contentStyle={{
													borderRadius: 0,
													border: "1px solid #93c5fd",
													fontSize: 11,
												}}
											/>
											<Area
												type="monotone"
												dataKey="memory"
												stroke="#93c5fd"
												fill="url(#memGrad)"
												strokeWidth={2}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</Card>

								{/* Latency Chart */}
								<Card
									className="p-4 rounded"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--color-lavender-border)",
									}}
								>
									<h3
										className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
										style={{ color: "var(--text-muted)" }}
									>
										<Clock
											className="w-3 h-3"
											style={{ color: "var(--color-lavender)" }}
										/>{" "}
										Gecikme (ms)
									</h3>
									<ResponsiveContainer width="100%" height={200}>
										<AreaChart data={chartData}>
											<defs>
												<linearGradient
													id="latGrad"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#c4b5fd"
														stopOpacity={0.15}
													/>
													<stop
														offset="95%"
														stopColor="#c4b5fd"
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis
												dataKey="time"
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
											/>
											<YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
											<Tooltip
												contentStyle={{
													borderRadius: 0,
													border: "1px solid #c4b5fd",
													fontSize: 11,
												}}
											/>
											<Area
												type="monotone"
												dataKey="latency"
												stroke="#c4b5fd"
												fill="url(#latGrad)"
												strokeWidth={2}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</Card>

								{/* Error Rate Chart */}
								<Card
									className="p-4 rounded"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--status-down-border)",
									}}
								>
									<h3
										className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
										style={{ color: "var(--text-muted)" }}
									>
										<Zap
											className="w-3 h-3"
											style={{ color: "var(--status-down)" }}
										/>{" "}
										Hata Oranı (%)
									</h3>
									<ResponsiveContainer width="100%" height={200}>
										<AreaChart data={chartData}>
											<defs>
												<linearGradient
													id="errGrad"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#fda4af"
														stopOpacity={0.15}
													/>
													<stop
														offset="95%"
														stopColor="#fda4af"
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
											<XAxis
												dataKey="time"
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
											/>
											<YAxis
												tick={{ fontSize: 10 }}
												stroke="#b0bdd5"
												domain={[0, "auto"]}
											/>
											<Tooltip
												contentStyle={{
													borderRadius: 0,
													border: "1px solid #fda4af",
													fontSize: 11,
												}}
											/>
											<Area
												type="monotone"
												dataKey="error_rate"
												stroke="#fda4af"
												fill="url(#errGrad)"
												strokeWidth={2}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</Card>
							</div>
						)}
					</TabsContent>

					{/* Alerts Tab */}
					<TabsContent value="alerts" className="space-y-3">
						{alerts.length === 0 ? (
							<Card
								className="p-12 rounded text-center"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--color-teal-border)",
								}}
							>
								<Shield
									className="w-10 h-10 mx-auto mb-3"
									style={{ color: "var(--status-up)" }}
								/>
								<p className="text-sm" style={{ color: "var(--text-muted)" }}>
									Aktif uyarı yok — tüm sistemler çalışıyor
								</p>
							</Card>
						) : (
							alerts.map((alert, index) => (
								<motion.div
									key={alert.id}
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.05 }}
								>
									<Card
										className="p-4 rounded"
										style={{
											background: "var(--surface-card)",
											border: "1px solid",
											borderColor:
												alert.severity === "crit"
													? "var(--status-down-border)"
													: alert.severity === "warn"
														? "var(--status-warn-border)"
														: "var(--color-blue-border)",
										}}
									>
										<div className="flex items-start justify-between">
											<div className="flex items-start gap-3">
												<div
													className="w-2 h-2 rounded-full mt-1.5 shrink-0"
													style={{
														backgroundColor:
															alert.severity === "crit"
																? "var(--status-down)"
																: alert.severity === "warn"
																	? "var(--status-warn)"
																	: "var(--color-blue)",
													}}
												/>
												<div>
													<div className="flex items-center gap-2 mb-1">
														<Badge
															className="text-[9px] px-1.5 py-0 rounded border uppercase font-mono"
															style={{
																background:
																	alert.severity === "crit"
																		? "var(--status-down-subtle)"
																		: alert.severity === "warn"
																			? "var(--status-warn-subtle)"
																			: "var(--color-blue-subtle)",
																color:
																	alert.severity === "crit"
																		? "var(--status-down-text)"
																		: alert.severity === "warn"
																			? "var(--status-warn-text)"
																			: "var(--color-blue)",
																borderColor:
																	alert.severity === "crit"
																		? "var(--status-down-border)"
																		: alert.severity === "warn"
																			? "var(--status-warn-border)"
																			: "var(--color-blue-border)",
															}}
														>
															{alert.severity}
														</Badge>
														<span
															className="text-[10px]"
															style={{ color: "var(--text-faint)" }}
														>
															{alert.type}
														</span>
													</div>
													<p
														className="text-xs"
														style={{ color: "var(--text-secondary)" }}
													>
														{alert.message}
													</p>
													<p
														className="text-[10px] mt-1"
														style={{ color: "var(--text-faint)" }}
													>
														{new Date(alert.triggered_at).toLocaleString(
															"tr-TR",
														)}
													</p>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleResolveAlert(alert.id)}
												className="text-[10px] rounded h-7"
												style={{
													borderColor: "var(--status-up-border)",
													color: "var(--status-up-text)",
												}}
											>
												Çöz
											</Button>
										</div>
									</Card>
								</motion.div>
							))
						)}
					</TabsContent>

					{/* Terminal Tab */}
					<TabsContent value="terminal" className="space-y-3">
						{/* Agent bağlantı durumu */}
						{service?.agent_connected ? (
							<div
								className="flex items-center gap-2 px-3 py-2 rounded text-xs"
								style={{
									background: "var(--status-up-subtle)",
									border: "1px solid var(--status-up-border)",
								}}
							>
								<CheckCircle2
									className="w-3.5 h-3.5 shrink-0"
									style={{ color: "var(--status-up)" }}
								/>
								<span style={{ color: "var(--status-up-text)" }}>
									Agent bağlı — komutlar doğrudan iletilecek
								</span>
							</div>
						) : (
							<div
								className="flex items-start gap-3 px-4 py-3 rounded text-xs"
								style={{
									background: "var(--status-warn-subtle)",
									border: "1px solid var(--status-warn-border)",
								}}
							>
								<AlertCircle
									className="w-4 h-4 shrink-0 mt-0.5"
									style={{ color: "var(--status-warn)" }}
								/>
								<div>
									<p
										className="font-medium mb-0.5"
										style={{ color: "var(--status-warn-text)" }}
									>
										Agent bağlı değil
									</p>
									<p style={{ color: "var(--text-muted)" }}>
										Terminal, servis üzerinde komut çalıştırmak için NanoNet
										Agent gerektirir. "Agent Kur" butonuyla kurulum
										talimatlarını alabilirsiniz.
									</p>
								</div>
							</div>
						)}
						<Card
							className="rounded overflow-hidden"
							style={{
								background: "var(--terminal-bg, var(--surface-sunken))",
								border:
									"2px solid var(--terminal-border, var(--border-strong))",
							}}
						>
							{/* Title bar */}
							<div
								className="flex items-center gap-2 px-4 py-2.5"
								style={{
									borderBottom:
										"2px solid var(--terminal-border, var(--border-strong))",
									background: "var(--terminal-header, var(--surface-overlay))",
								}}
							>
								<div className="flex gap-1.5">
									<div
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: "#ff5f57" }}
									/>
									<div
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: "#febc2e" }}
									/>
									<div
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: "#28c840" }}
									/>
								</div>
								<span
									className="text-[10px] font-mono ml-2"
									style={{ color: "var(--text-faint)" }}
								>
									{service?.name ?? "terminal"} — exec
								</span>
								<div className="ml-auto flex items-center gap-2">
									{execHistory.length > 0 && (
										<button
											type="button"
											onClick={() => setExecHistory([])}
											className="text-[10px] transition-colors hover:opacity-80"
											style={{ color: "var(--text-faint)" }}
										>
											temizle
										</button>
									)}
								</div>
							</div>
							{/* Output area */}
							<div className="p-4 h-80 overflow-y-auto space-y-3 font-mono text-xs">
								{execHistory.length === 0 ? (
									<div className="flex flex-col items-center justify-center h-full gap-3 select-none">
										<Terminal
											className="w-10 h-10"
											style={{ color: "var(--border-strong)" }}
										/>
										<p
											className="text-[11px]"
											style={{ color: "var(--text-faint)" }}
										>
											Komut girin ve Enter tuşuna basın
										</p>
										<div className="flex flex-wrap gap-2 mt-1 justify-center">
											{["uptime", "ps aux", "df -h", "free -m"].map((s) => (
												<button
													type="button"
													key={s}
													onClick={() => setExecCommand(s)}
													className="px-2 py-1 rounded text-[10px] transition-colors hover:opacity-80"
													style={{
														background: "var(--surface-overlay)",
														color: "var(--color-teal)",
													}}
												>
													{s}
												</button>
											))}
										</div>
									</div>
								) : (
									<>
										{execHistory.map((entry) => (
											<div key={entry.command_id} className="space-y-1">
												{/* Command line */}
												<div className="flex items-center gap-1.5">
													<span
														className="shrink-0"
														style={{ color: "var(--color-teal)" }}
													>
														$
													</span>
													<span style={{ color: "var(--text-secondary)" }}>
														{entry.command}
													</span>
													<span
														className="ml-auto text-[10px]"
														style={{ color: "var(--text-faint)" }}
													>
														{new Date(entry.queued_at).toLocaleTimeString(
															"tr-TR",
														)}
													</span>
												</div>
												{/* Status indicator */}
												<div className="flex items-center gap-1.5 pl-3">
													{entry.status === "queued" ||
													entry.status === "received" ? (
														<>
															<Loader2
																className="w-3 h-3 animate-spin"
																style={{ color: "var(--status-warn)" }}
															/>
															<span
																className="text-[10px]"
																style={{ color: "var(--status-warn-text)" }}
															>
																{entry.status}...
															</span>
														</>
													) : entry.status === "success" ? (
														<>
															<CheckCircle2
																className="w-3 h-3"
																style={{ color: "var(--status-up)" }}
															/>
															<span
																className="text-[10px]"
																style={{ color: "var(--status-up-text)" }}
															>
																başarılı
															</span>
														</>
													) : (
														<>
															<XCircle
																className="w-3 h-3"
																style={{ color: "var(--status-down)" }}
															/>
															<span
																className="text-[10px]"
																style={{ color: "var(--status-down-text)" }}
															>
																{entry.status}
															</span>
														</>
													)}
													{entry.duration_ms !== undefined && (
														<span
															className="text-[10px] ml-auto"
															style={{ color: "var(--text-faint)" }}
														>
															{entry.duration_ms}ms
														</span>
													)}
												</div>
												{/* Output */}
												{entry.output && (
													<pre
														className="pl-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded p-2"
														style={{
															color: "var(--text-muted)",
															background: "var(--surface-sunken)",
															border: "1px solid var(--border-default)",
														}}
													>
														{entry.output}
													</pre>
												)}
												{/* Error */}
												{entry.error && (
													<pre
														className="pl-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded p-2"
														style={{
															color: "var(--status-down-text)",
															background: "var(--status-down-subtle)",
															border: "1px solid var(--status-down-border)",
														}}
													>
														{entry.error}
													</pre>
												)}
											</div>
										))}
										<div ref={terminalEndRef} />
									</>
								)}
							</div>
							{/* Input area */}
							<div
								className="flex items-center gap-2 px-4 py-3"
								style={{
									borderTop:
										"2px solid var(--terminal-border, var(--border-strong))",
									background: "var(--terminal-header, var(--surface-overlay))",
								}}
							>
								<span
									className="font-mono text-xs shrink-0"
									style={{ color: "var(--color-teal)" }}
								>
									❯
								</span>
								<Input
									value={execCommand}
									onChange={(e) => setExecCommand(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !execLoading) handleExecRequest();
									}}
									placeholder="komut girin..."
									disabled={execLoading}
									className="bg-transparent border-none font-mono text-xs h-7 px-0 focus-visible:ring-0"
									style={{ color: "var(--text-secondary)" }}
								/>
								<Button
									size="sm"
									onClick={handleExecRequest}
									disabled={execLoading || !execCommand.trim()}
									className="h-7 px-3 rounded shrink-0"
									style={{
										borderColor: "var(--color-teal-border)",
										color: "var(--color-teal)",
									}}
									variant="outline"
								>
									{execLoading ? (
										<Loader2 className="w-3 h-3 animate-spin" />
									) : (
										<Send className="w-3 h-3" />
									)}
								</Button>
							</div>
						</Card>
					</TabsContent>

					{/* Load Balancing & Orchestration Tab */}
					<TabsContent value="scale" className="space-y-4">
						<LoadBalancingTab
							serviceId={serviceId ?? ""}
							serviceName={service?.name ?? ""}
							scaleInstances={scaleInstances}
							setScaleInstances={setScaleInstances}
							scaleStrategy={scaleStrategy}
							setScaleStrategy={setScaleStrategy}
							scaleLoading={scaleLoading}
							handleScale={handleScale}
						/>
					</TabsContent>

					{/* Command History Tab */}
					<TabsContent value="history" className="space-y-3">
						<CommandHistoryTab serviceId={serviceId ?? ""} />
					</TabsContent>

					{/* Alert Rules Tab */}
					<TabsContent value="alert-rules">
						<AlertRulesTab serviceId={serviceId ?? ""} />
					</TabsContent>

					{/* Maintenance Tab */}
					<TabsContent value="maintenance">
						<MaintenanceTab serviceId={serviceId ?? ""} />
					</TabsContent>

					{/* Exec Confirm Dialog — oturum başında yalnızca bir kez gösterilir */}
					<Dialog
						open={execConfirmOpen}
						onOpenChange={(open) => {
							if (!open) {
								setExecConfirmOpen(false);
								setPendingCommand("");
							}
						}}
					>
						<DialogContent
							className="rounded max-w-sm"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--status-warn-border)",
								boxShadow: "var(--panel-shadow)",
							}}
						>
							<DialogHeader>
								<DialogTitle style={{ color: "var(--status-warn-text)" }}>
									Terminal Erişimi
								</DialogTitle>
								<DialogDescription asChild>
									<div
										className="space-y-3 text-xs"
										style={{ color: "var(--text-muted)" }}
									>
										<p>
											Bu terminal,{" "}
											<strong style={{ color: "var(--text-secondary)" }}>
												{service?.name}
											</strong>{" "}
											servisinin çalıştığı sunucuda doğrudan komut çalıştırır.
										</p>
										<ul
											className="space-y-1 pl-3"
											style={{
												borderLeft: "1px solid var(--status-warn-border)",
											}}
										>
											<li>
												Yalnızca{" "}
												<code
													className="font-mono"
													style={{ color: "var(--color-teal)" }}
												>
													status
												</code>
												,{" "}
												<code
													className="font-mono"
													style={{ color: "var(--color-teal)" }}
												>
													mem
												</code>
												,{" "}
												<code
													className="font-mono"
													style={{ color: "var(--color-teal)" }}
												>
													cpu
												</code>
												,{" "}
												<code
													className="font-mono"
													style={{ color: "var(--color-teal)" }}
												>
													ps
												</code>{" "}
												gibi salt-okunur komutlar güvenlidir
											</li>
											<li>
												Pipe (<code className="font-mono">|</code>), zincirleme
												(<code className="font-mono">&amp;&amp;</code>,{" "}
												<code className="font-mono">;</code>) ve yönlendirme (
												<code className="font-mono">&gt;</code>) operatörleri
												engellenir
											</li>
											<li>
												Servis sürecini etkileyen komutlar sorumluluğunuzdadır
											</li>
										</ul>
										<p style={{ color: "var(--text-faint)" }}>
											Onayladıktan sonra bu oturumda bir daha sorulmayacak.
										</p>
									</div>
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setExecConfirmOpen(false);
										setPendingCommand("");
									}}
									className="rounded text-xs"
								>
									İptal
								</Button>
								<Button
									onClick={() => {
										sessionStorage.setItem("exec_session_confirmed", "1");
										setExecSessionConfirmed(true);
										setExecConfirmOpen(false);
										void handleExecDirect(pendingCommand);
										setPendingCommand("");
									}}
									className="rounded text-xs"
									style={{ background: "var(--status-warn)", color: "white" }}
								>
									<Terminal className="w-3 h-3 mr-1" /> Anladım, Devam Et
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* AI Tab */}
					<TabsContent value="ai" className="space-y-4">
						<Card
							className="p-6 rounded"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--color-lavender-border)",
							}}
						>
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<Sparkles
										className="w-4 h-4"
										style={{ color: "var(--color-lavender)" }}
									/>
									<h3
										className="text-sm font-semibold"
										style={{ color: "var(--text-secondary)" }}
									>
										AI Analiz
									</h3>
								</div>
								<div className="flex items-center gap-2">
									<div
										className="flex rounded overflow-hidden border"
										style={{ borderColor: "var(--color-lavender-border)" }}
									>
										<button
											type="button"
											onClick={() => setDeepAnalysis(false)}
											className="px-3 py-1.5 text-[10px] font-medium transition-all"
											style={
												!deepAnalysis
													? {
															background: "var(--color-lavender-subtle)",
															color: "var(--color-lavender)",
														}
													: { color: "var(--text-muted)" }
											}
										>
											Hızlı
										</button>
										<button
											type="button"
											onClick={() => setDeepAnalysis(true)}
											className="px-3 py-1.5 text-[10px] font-medium transition-all"
											style={
												deepAnalysis
													? {
															background: "var(--color-lavender-subtle)",
															color: "var(--color-lavender)",
														}
													: { color: "var(--text-muted)" }
											}
										>
											Derin
										</button>
									</div>
									<Button
										onClick={handleAnalyze}
										disabled={analyzeLoading}
										className="text-white rounded text-xs h-8"
										style={{
											background: "var(--gradient-btn-primary)",
											boxShadow: "var(--btn-shadow)",
										}}
									>
										{analyzeLoading ? (
											<>
												<RefreshCw className="w-3 h-3 mr-1 animate-spin" />{" "}
												Analiz Ediliyor...
											</>
										) : (
											<>
												<Sparkles className="w-3 h-3 mr-1" /> Analiz Başlat
											</>
										)}
									</Button>
								</div>
							</div>

							{analysisResult ? (
								<div className="space-y-4">
									<div
										className="p-4 rounded"
										style={{
											background: "var(--surface-sunken)",
											border: "1px solid var(--border-default)",
										}}
									>
										<h4
											className="text-xs uppercase tracking-wider mb-2"
											style={{ color: "var(--text-muted)" }}
										>
											Özet
										</h4>
										<p
											className="text-sm"
											style={{ color: "var(--text-secondary)" }}
										>
											{analysisResult.summary}
										</p>
									</div>
									{analysisResult.root_cause && (
										<div
											className="p-4 rounded"
											style={{
												background: "var(--status-down-subtle)",
												border: "1px solid var(--status-down-border)",
											}}
										>
											<h4
												className="text-xs uppercase tracking-wider mb-2"
												style={{ color: "var(--text-muted)" }}
											>
												Kök Neden
											</h4>
											<p
												className="text-sm"
												style={{ color: "var(--text-secondary)" }}
											>
												{analysisResult.root_cause}
											</p>
										</div>
									)}
									{analysisResult.recommendations &&
										analysisResult.recommendations.length > 0 && (
											<div
												className="p-4 rounded"
												style={{
													background: "var(--color-teal-subtle)",
													border: "1px solid var(--color-teal-border)",
												}}
											>
												<h4
													className="text-xs uppercase tracking-wider mb-2"
													style={{ color: "var(--text-muted)" }}
												>
													Öneriler
												</h4>
												<ul className="space-y-2">
													{analysisResult.recommendations.map((rec) => (
														<li
															key={rec.action}
															className="flex items-start gap-2"
														>
															<Badge
																className="text-[9px] px-1.5 py-0 rounded shrink-0 mt-0.5"
																style={{
																	background:
																		rec.priority === "high"
																			? "var(--status-down-subtle)"
																			: rec.priority === "medium"
																				? "var(--status-warn-subtle)"
																				: "var(--color-teal-subtle)",
																	color:
																		rec.priority === "high"
																			? "var(--status-down-text)"
																			: rec.priority === "medium"
																				? "var(--status-warn-text)"
																				: "var(--color-teal)",
																}}
															>
																{rec.priority}
															</Badge>
															<span
																className="text-xs"
																style={{ color: "var(--text-secondary)" }}
															>
																{rec.action}
															</span>
														</li>
													))}
												</ul>
											</div>
										)}
									{analysisResult.confidence !== undefined && (
										<div
											className="flex items-center gap-2 text-[10px]"
											style={{ color: "var(--text-faint)" }}
										>
											<Eye className="w-3 h-3" /> Güven:{" "}
											{(analysisResult.confidence * 100).toFixed(0)}%
										</div>
									)}
								</div>
							) : (
								<div className="text-center py-8">
									<Sparkles
										className="w-8 h-8 mx-auto mb-3"
										style={{ color: "var(--color-lavender-subtle)" }}
									/>
									<p className="text-xs" style={{ color: "var(--text-muted)" }}>
										AI destekli analiz için "Analiz Başlat" butonuna tıklayın
									</p>
								</div>
							)}
						</Card>
					</TabsContent>
				</Tabs>
				{/* Logs — always mounted outside Tabs so WS stream is not torn down on tab switch */}
				<div
					style={{ display: activeTab === "logs" ? "block" : "none" }}
					className="h-130"
				>
					<LogViewer serviceId={serviceId ?? ""} serviceName={service?.name} />
				</div>
			</motion.div>

			{/* Agent Setup Wizard */}
			<AgentSetupWizard
				open={agentWizardOpen}
				onClose={() => setAgentWizardOpen(false)}
				serviceId={serviceId}
				serviceName={service?.name}
			/>
		</PageShell>
	);
}
