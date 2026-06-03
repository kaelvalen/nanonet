import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	AlertTriangle,
	Bot,
	Check,
	CheckCircle2,
	Clock,
	Copy,
	Loader2,
	Play,
	Power,
	RefreshCw,
	Square,
	WifiOff,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { servicesApi } from "@/api/services";
import { useRegisterPageMeta } from "@/components/PageMetaContext";
import { Button } from "@/components/ui/button";
import type { Service } from "@/types/service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso?: string | null): string {
	if (!iso) return "—";
	const diff = Date.now() - new Date(iso).getTime();
	const s = Math.floor(diff / 1000);
	if (s < 15) return "az önce";
	if (s < 60) return `${s}s önce`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}dk önce`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}sa önce`;
	return `${Math.floor(h / 24)}g önce`;
}

// Heartbeat 2 dakikadan eskiyse stale sayıyoruz — muhtemelen önce bağlıydı
function isHeartbeatFresh(iso?: string | null): boolean {
	if (!iso) return false;
	return Date.now() - new Date(iso).getTime() < 2 * 60 * 1000;
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<button
			type="button"
			onClick={copy}
			className="shrink-0 p-1.5 rounded-[4px] transition-colors"
			style={{
				background: copied ? "var(--status-up-subtle)" : "var(--surface-sunken)",
				color: copied ? "var(--status-up-text)" : "var(--text-tertiary)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
		</button>
	);
}

// ── Disconnected: inline start command ───────────────────────────────────────

function DisconnectedAgent({ svc }: { svc: Service }) {
	const agentBackend = import.meta.env.VITE_AGENT_BACKEND ??
		`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
	const [token, setToken] = useState<string | null>(null);

	const generateToken = useMutation({
		mutationFn: () => authApi.createAgentToken(svc.id),
		onSuccess: setToken,
		onError: () => toast.error("Token oluşturulamadı"),
	});

	const winCmd = token
		? `.\\nanonet-agent.exe --backend ${agentBackend} --agent-token ${token} --service-id ${svc.id}`
		: null;
	const linuxCmd = token
		? `./nanonet-agent --backend ${agentBackend} --agent-token ${token} --service-id ${svc.id}`
		: null;

	return (
		<div className="space-y-2 mt-2">
			{!token ? (
				<Button
					size="sm"
					variant="outline"
					onClick={() => generateToken.mutate()}
					disabled={generateToken.isPending}
					className="gap-1.5 text-[12px]"
				>
					{generateToken.isPending
						? <Loader2 className="w-3 h-3 animate-spin" />
						: <Zap className="w-3 h-3" />}
					Token oluştur & başlatma komutunu göster
				</Button>
			) : (
				<div className="space-y-1.5">
					{([
						{ label: "Windows (PowerShell)", cmd: winCmd! },
						{ label: "Linux / macOS",        cmd: linuxCmd! },
					] as const).map(({ label, cmd }) => (
						<div key={label}
							className="rounded-[6px] p-2.5 flex items-start gap-2"
							style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
						>
							<span className="text-[10px] uppercase tracking-wider shrink-0 mt-0.5 w-24 sm:w-28"
								style={{ color: "var(--text-faint)" }}>{label}</span>
							<pre
								className="flex-1 font-mono text-[11px] overflow-x-auto"
								style={{ color: "var(--text-secondary)", whiteSpace: "pre", scrollbarWidth: "none" }}
								title={cmd}
							>{cmd}</pre>
							<CopyButton value={cmd} />
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── Agent status badge ────────────────────────────────────────────────────────

function StatusBadge({ svc }: { svc: Service }) {
	if (!svc.agent_connected) {
		return (
			<span
				className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
				style={{ background: "var(--surface-sunken)", color: "var(--text-faint)" }}
			>
				<WifiOff className="w-3 h-3" />
				Bağlı değil
			</span>
		);
	}

	// Agent bağlı ama heartbeat stale ise farklı göster
	if (!isHeartbeatFresh(svc.agent_last_heartbeat_at)) {
		return (
			<span
				className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
				style={{ background: "var(--status-degraded-subtle)", color: "var(--status-degraded-text)" }}
			>
				<Clock className="w-3 h-3" />
				Gecikmiş
			</span>
		);
	}

	const map = {
		healthy: { label: "Sağlıklı", color: "var(--status-up-text)", bg: "var(--status-up-subtle)", Icon: CheckCircle2 },
		stale:   { label: "Gecikmeli", color: "var(--status-degraded-text)", bg: "var(--status-degraded-subtle)", Icon: Clock },
		down:    { label: "Yanıtsız", color: "var(--status-down-text)", bg: "var(--status-down-subtle)", Icon: AlertTriangle },
		unknown: { label: "Bağlı", color: "var(--status-up-text)", bg: "var(--status-up-subtle)", Icon: Bot },
	} as const;
	const s = map[svc.agent_status ?? "unknown"];
	return (
		<span
			className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
			style={{ background: s.bg, color: s.color }}
		>
			<s.Icon className="w-3 h-3" />
			{s.label}
		</span>
	);
}

// ── Single agent row ──────────────────────────────────────────────────────────

function AgentRow({ svc }: { svc: Service }) {
	const qc = useQueryClient();
	const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });
	const connected = !!svc.agent_connected;

	const stop = useMutation({
		mutationFn: () => servicesApi.stop(svc.id),
		onSuccess: () => { toast.success(`${svc.name}: durdurma gönderildi`); invalidate(); },
		onError: () => toast.error("Komut gönderilemedi"),
	});
	const start = useMutation({
		mutationFn: () => servicesApi.start(svc.id),
		onSuccess: () => { toast.success(`${svc.name}: başlatma gönderildi`); invalidate(); },
		onError: () => toast.error("Komut gönderilemedi"),
	});
	const restart = useMutation({
		mutationFn: () => servicesApi.restart(svc.id),
		onSuccess: () => { toast.success(`${svc.name}: yeniden başlatma gönderildi`); invalidate(); },
		onError: () => toast.error("Komut gönderilemedi"),
	});
	const busy = stop.isPending || start.isPending || restart.isPending;

	return (
		<div
			className="rounded-[8px] px-4 py-3"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div className="flex items-center gap-3">
				{/* Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-0.5 flex-wrap">
						<span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
							{svc.name}
						</span>
						<StatusBadge svc={svc} />
					</div>
					<div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
						<span className="font-mono">{svc.host}:{svc.port}</span>
						{svc.agent_version && <span>v{svc.agent_version}</span>}
						{connected && isHeartbeatFresh(svc.agent_last_heartbeat_at) && (
							<span className="flex items-center gap-1" style={{ color: "var(--status-up-text)" }}>
								<Clock className="w-3 h-3" />
								{relativeTime(svc.agent_last_heartbeat_at)}
							</span>
						)}
						{connected && !isHeartbeatFresh(svc.agent_last_heartbeat_at) && (
							<span className="flex items-center gap-1" style={{ color: "var(--status-degraded-text)" }}>
								<Clock className="w-3 h-3" />
								Son: {relativeTime(svc.agent_last_heartbeat_at)}
							</span>
						)}
					</div>
				</div>

				{/* Connected controls */}
				{connected && (
					<div className="flex items-center gap-1.5 shrink-0">
						<Button size="sm" variant="outline" onClick={() => start.mutate()} disabled={busy} title="Agent'ı başlat">
							{start.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
						</Button>
						<Button size="sm" variant="outline" onClick={() => restart.mutate()} disabled={busy} title="Agent'ı yeniden başlat">
							{restart.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
						</Button>
						<Button size="sm" variant="outline" onClick={() => stop.mutate()} disabled={busy} title="Agent'ı durdur"
							style={{ color: stop.isPending ? undefined : "var(--status-down-text)" }}>
							{stop.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
						</Button>
					</div>
				)}
			</div>

			{/* Disconnected: inline start command */}
			{!connected && <DisconnectedAgent svc={svc} />}
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentsPage() {
	const qc = useQueryClient();

	const { data: services = [], isLoading } = useQuery({
		queryKey: ["services"],
		queryFn: servicesApi.list,
		refetchInterval: 15_000,
	});

	const connected    = services.filter((s) => !!s.agent_connected);
	const disconnected = services.filter((s) => !s.agent_connected);

	const stopAll = useMutation({
		mutationFn: () => Promise.allSettled(connected.map((s) => servicesApi.stop(s.id))),
		onSuccess: () => { toast.success("Tümüne durdur gönderildi"); qc.invalidateQueries({ queryKey: ["services"] }); },
	});
	const startAll = useMutation({
		mutationFn: () => Promise.allSettled(connected.map((s) => servicesApi.start(s.id))),
		onSuccess: () => { toast.success("Tümüne başlat gönderildi"); qc.invalidateQueries({ queryKey: ["services"] }); },
	});
	const restartAll = useMutation({
		mutationFn: () => Promise.allSettled(connected.map((s) => servicesApi.restart(s.id))),
		onSuccess: () => { toast.success("Tümüne yeniden başlat gönderildi"); qc.invalidateQueries({ queryKey: ["services"] }); },
	});
	const allBusy = stopAll.isPending || startAll.isPending || restartAll.isPending;

	return (
		<PageShell width="wide" fill={false}>
			<div className="flex items-center justify-between flex-wrap gap-3">
				<PageHeader eyebrow="Altyapı" title="Agents" description="Agent binary'lerini izle ve yönet" />
				{connected.length > 0 && (
					<div className="flex items-center gap-2 flex-wrap">
						<Button size="sm" variant="outline" onClick={() => startAll.mutate()} disabled={allBusy} className="gap-1.5">
							{startAll.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
							Tümünü Başlat
						</Button>
						<Button size="sm" variant="outline" onClick={() => restartAll.mutate()} disabled={allBusy} className="gap-1.5">
							{restartAll.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
							Tümünü Yeniden Başlat
						</Button>
						<Button size="sm" variant="outline" onClick={() => stopAll.mutate()} disabled={allBusy} className="gap-1.5"
							style={{ color: "var(--status-down-text)" }}>
							{stopAll.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
							Tümünü Durdur
						</Button>
					</div>
				)}
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{([
					{ label: "Toplam",      value: services.length,    color: "var(--text-primary)" },
					{ label: "Bağlı",       value: connected.length,   color: connected.length > 0 ? "var(--status-up-text)" : "var(--text-faint)" },
					{ label: "Bağlı Değil", value: disconnected.length, color: disconnected.length > 0 ? "var(--status-degraded-text)" : "var(--text-faint)" },
					{ label: "Sorunlu",     value: services.filter((s) => s.agent_status === "stale" || s.agent_status === "down").length, color: services.filter((s) => s.agent_status === "stale" || s.agent_status === "down").length > 0 ? "var(--status-down-text)" : "var(--text-faint)" },
				] as const).map((stat) => (
					<div key={stat.label} className="rounded-[8px] px-4 py-3"
						style={{ background: "var(--surface-base)", border: "1px solid var(--border-subtle)" }}>
						<p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>
							{stat.label}
						</p>
						<span className="text-[22px] font-semibold tnum" style={{ color: stat.color }}>
							{stat.value}
						</span>
					</div>
				))}
			</div>

			{/* Loading */}
			{isLoading && (
				<div className="flex justify-center py-16">
					<Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-faint)" }} />
				</div>
			)}

			{/* Connected */}
			{!isLoading && connected.length > 0 && (
				<section className="space-y-2">
					<h2 className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: "var(--text-faint)" }}>
						Bağlı ({connected.length})
					</h2>
					{connected.map((svc) => <AgentRow key={svc.id} svc={svc} />)}
				</section>
			)}

			{/* Disconnected */}
			{!isLoading && disconnected.length > 0 && (
				<section className="space-y-2">
					<h2 className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: "var(--text-faint)" }}>
						Bağlı Değil ({disconnected.length})
					</h2>
					{disconnected.map((svc) => <AgentRow key={svc.id} svc={svc} />)}
				</section>
			)}

			{/* Empty */}
			{!isLoading && services.length === 0 && (
				<div className="flex flex-col items-center justify-center py-20 gap-3">
					<Bot className="w-10 h-10" style={{ color: "var(--text-faint)" }} />
					<p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>Henüz servis yok</p>
				</div>
			)}
		</PageShell>
	);
}
