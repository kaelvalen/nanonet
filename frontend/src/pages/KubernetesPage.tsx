import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Box,
    Cpu,
    Layers,
    Server,
    RefreshCw,
    Plus,
    Minus,
    Loader2,
    Cloud,
    CloudOff,
    Trash2,
    Settings2,
    Network,
    Gauge,
    Activity,
    MemoryStick,
    ChevronDown,
    ChevronRight,
    Search,
    Zap,
    GitBranch,
    HardDrive,
    Terminal,
    RotateCcw,
    Globe,
    Share2,
    AlertTriangle,
    Bell,
    X,
    Package2,
    PackageCheck,
    PackageX,
} from "lucide-react";
import { k8sApi, type PodInfo, type DeploymentInfo, type HPAInfo, type NodeInfo, type ServiceInfo, type EventInfo } from "@/api/k8s";
import { servicesApi } from "@/api/services";
import type { Service } from "@/types/service";

type TabType = "overview" | "pods" | "deployments" | "hpa" | "services" | "endpoints" | "events" | "nanonet";

function StatusDot({ ready, size = "sm" }: { ready: boolean; size?: "sm" | "md" }) {
    const sz = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
    return (
        <div className="relative shrink-0">
            <div className={`${sz} rounded-full`} style={{ backgroundColor: ready ? "var(--status-up)" : "var(--status-down)" }} />
            {ready && <div className={`absolute inset-0 ${sz} rounded-full animate-pulse-ring`} style={{ backgroundColor: "var(--status-up)" }} />}
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
    return (
        <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider truncate" style={{ color: "var(--text-faint)" }}>{label}</p>
                    <p className="text-xl font-bold leading-tight" style={{ color }}>{value}</p>
                    {sub && <p className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>{sub}</p>}
                </div>
            </div>
        </Card>
    );
}

function PodStatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { bg: string; text: string; border: string }> = {
        Running:   { bg: "var(--status-up-subtle)",   text: "var(--status-up-text)",   border: "var(--status-up-border)" },
        Pending:   { bg: "var(--status-warn-subtle)",  text: "var(--status-warn-text)",  border: "var(--status-warn-border)" },
        Failed:    { bg: "var(--status-down-subtle)", text: "var(--status-down-text)", border: "var(--status-down-border)" },
        Succeeded: { bg: "var(--color-teal-subtle)",  text: "var(--color-teal)",       border: "var(--color-teal-border)" },
        Unknown:   { bg: "var(--surface-sunken)",     text: "var(--text-faint)",       border: "var(--border-subtle)" },
    };
    const s = cfg[status] ?? cfg["Failed"];
    return (
        <Badge className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
            style={{ background: s.bg, color: s.text, borderColor: s.border }}>
            {status}
        </Badge>
    );
}

function MemoryToGB(raw: string): string {
    if (!raw) return "—";
    const ki = parseInt(raw.replace("Ki", ""));
    if (isNaN(ki)) return raw;
    return (ki / 1024 / 1024).toFixed(1) + " GB";
}

// ─── Servis tipi rozeti ─────────────────────────────────────────────────────────────────
function ServiceTypeBadge({ type }: { type: string }) {
    const cfg: Record<string, { bg: string; text: string; border: string }> = {
        ClusterIP:    { bg: "var(--color-blue-subtle)",     text: "var(--color-blue)",     border: "var(--color-blue-border)" },
        NodePort:     { bg: "var(--status-warn-subtle)",    text: "var(--status-warn-text)", border: "var(--status-warn-border)" },
        LoadBalancer: { bg: "var(--status-up-subtle)",      text: "var(--status-up-text)",  border: "var(--status-up-border)" },
        ExternalName: { bg: "var(--color-lavender-subtle)", text: "var(--color-lavender)",  border: "var(--color-lavender-border)" },
    };
    const s = cfg[type] ?? cfg["ClusterIP"];
    return (
        <Badge className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
            style={{ background: s.bg, color: s.text, borderColor: s.border }}>
            {type}
        </Badge>
    );
}

// ─── Pod Log Modal ─────────────────────────────────────────────────────────────────────
function PodLogModal({ podName, onClose }: { podName: string; onClose: () => void }) {
    const [lines, setLines] = useState<number>(100);
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["k8s-pod-logs", podName, lines],
        queryFn: () => k8sApi.getPodLogs(podName, lines),
        retry: 1,
    });
    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl w-full" style={{ background: "var(--surface-base)", border: "1px solid var(--border-subtle)" }}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                        <Terminal className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
                        <span style={{ fontFamily: "var(--font-mono)" }}>{podName}</span>
                        <span className="text-[10px] font-normal ml-1" style={{ color: "var(--text-faint)" }}>logları</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Son</p>
                    {([100, 200, 500] as const).map((n) => (
                        <button key={n} onClick={() => setLines(n)}
                            className="px-2.5 py-0.5 rounded-lg text-[10px] border transition-all"
                            style={lines === n
                                ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)", borderColor: "var(--color-teal-border)" }
                                : { color: "var(--text-muted)", borderColor: "var(--border-subtle)", background: "transparent" }}>
                            {n} satır
                        </button>
                    ))}
                    <button onClick={() => refetch()} disabled={isFetching}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] border ml-auto transition-all"
                        style={{ borderColor: "var(--color-teal-border)", color: "var(--color-teal)" }}>
                        {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Yenile
                    </button>
                </div>
                <div className="relative">
                    {isFetching && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg z-10"
                            style={{ background: "color-mix(in srgb, var(--surface-base) 80%, transparent)" }}>
                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--color-teal)" }} />
                        </div>
                    )}
                    <pre className="text-[10px] leading-relaxed p-4 rounded-xl overflow-auto max-h-96 whitespace-pre-wrap break-all"
                        style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        {data?.logs || (isFetching ? "Yükleniyor..." : "Log bulunamadı.")}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function KubernetesPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [podFilter, setPodFilter] = useState("");
    const [hpaDeployment, setHpaDeployment] = useState("");
    const [endpointName, setEndpointName] = useState("");
    const [expandedNode, setExpandedNode] = useState<string | null>(null);
    const [logPod, setLogPod] = useState<string | null>(null);
    const [eventKindFilter, setEventKindFilter] = useState<string>("all");
    const [eventTypeFilter, setEventTypeFilter] = useState<"" | "Warning" | "Normal">("Warning");

    // NanoNet → K8s deploy form state
    const [deployForms, setDeployForms] = useState<Record<string, { image: string; replicas: number; open: boolean }>>({});

    // Scale state
    const [scaleReplicas, setScaleReplicas] = useState<Record<string, number>>({});

    // HPA state
    const [hpaMin, setHpaMin] = useState(1);
    const [hpaMax, setHpaMax] = useState(5);
    const [hpaCpu, setHpaCpu] = useState(70);

    // K8s availability— 30s polling
    const { data: k8sStatus, isLoading: statusLoading } = useQuery({
        queryKey: ["k8s-status"],
        queryFn: k8sApi.getStatus,
        retry: 1,
        refetchInterval: 30000,
    });

    const isAvailable = k8sStatus?.available ?? false;

    // Nodes
    const { data: nodesData, isLoading: nodesLoading, refetch: refetchNodes } = useQuery({
        queryKey: ["k8s-nodes"],
        queryFn: k8sApi.getNodes,
        enabled: isAvailable,
        retry: 1,
        refetchInterval: 15000,
    });

    // Pods
    const { data: allPodsData, isLoading: allPodsLoading, refetch: refetchAllPods } = useQuery({
        queryKey: ["k8s-all-pods"],
        queryFn: k8sApi.getAllPods,
        enabled: isAvailable && (activeTab === "overview" || activeTab === "pods"),
        retry: 1,
        refetchInterval: 15000,
    });

    // Deployments
    const { data: deploymentsData, isLoading: deploymentsLoading, refetch: refetchDeployments } = useQuery({
        queryKey: ["k8s-deployments-list"],
        queryFn: k8sApi.listDeployments,
        enabled: isAvailable && (activeTab === "overview" || activeTab === "deployments" || activeTab === "hpa" || activeTab === "endpoints" || activeTab === "nanonet"),
        retry: 1,
        refetchInterval: 15000,
    });

    // HPA listesi
    const { data: hpasData, isLoading: hpasLoading, refetch: refetchHPAs } = useQuery({
        queryKey: ["k8s-hpas-list"],
        queryFn: k8sApi.listHPAs,
        enabled: isAvailable && activeTab === "hpa",
        retry: 1,
        refetchInterval: 20000,
    });

    // Servisler
    const { data: servicesData, isLoading: servicesLoading, refetch: refetchServices } = useQuery({
        queryKey: ["k8s-services"],
        queryFn: k8sApi.listServices,
        enabled: isAvailable && (activeTab === "services" || activeTab === "endpoints"),
        retry: 1,
        refetchInterval: 20000,
    });

    // K8s Events
    const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
        queryKey: ["k8s-events", eventKindFilter],
        queryFn: () => k8sApi.getEvents(eventKindFilter === "all" ? undefined : eventKindFilter),
        enabled: isAvailable && activeTab === "events",
        retry: 1,
        refetchInterval: 20000,
    });

    // NanoNet servisleri
    const { data: nanonetServicesData, isLoading: nanonetServicesLoading, refetch: refetchNanonetServices } = useQuery({
        queryKey: ["nanonet-services"],
        queryFn: servicesApi.list,
        enabled: activeTab === "nanonet",
        retry: 1,
        refetchInterval: 30000,
    });

    // Endpoints
    const { data: endpointsData, isLoading: endpointsLoading, refetch: refetchEndpoints } = useQuery({
        queryKey: ["k8s-endpoints", endpointName],
        queryFn: () => k8sApi.getEndpoints(endpointName),
        enabled: activeTab === "endpoints" && !!endpointName,
        retry: 1,
    });

    // Mutations
    const scaleMutation = useMutation({
        mutationFn: ({ name, replicas }: { name: string; replicas: number }) => k8sApi.scaleDeployment(name, replicas),
        onSuccess: (result) => {
            toast.success(result.message);
            queryClient.invalidateQueries({ queryKey: ["k8s-deployments-list"] });
        },
        onError: () => toast.error("Scale işlemi başarısız"),
    });

    const rolloutRestartMutation = useMutation({
        mutationFn: (name: string) => k8sApi.rolloutRestart(name),
        onSuccess: (res) => {
            toast.success(res.message);
            queryClient.invalidateQueries({ queryKey: ["k8s-deployments-list"] });
            queryClient.invalidateQueries({ queryKey: ["k8s-all-pods"] });
        },
        onError: () => toast.error("Rollout restart başarısız"),
    });

    const deletePodMutation = useMutation({
        mutationFn: (name: string) => k8sApi.deletePod(name),
        onSuccess: (res) => {
            toast.success(res.message);
            queryClient.invalidateQueries({ queryKey: ["k8s-all-pods"] });
        },
        onError: () => toast.error("Pod silinemedi"),
    });

    const hpaMutation = useMutation({
        mutationFn: () => k8sApi.createOrUpdateHPA(hpaDeployment, hpaMin, hpaMax, hpaCpu),
        onSuccess: () => {
            toast.success("HPA başarıyla oluşturuldu/güncellendi");
            refetchHPAs();
        },
        onError: () => toast.error("HPA işlemi başarısız"),
    });

    const deleteHPAMutation = useMutation({
        mutationFn: (name: string) => k8sApi.deleteHPA(name),
        onSuccess: () => {
            toast.success("HPA silindi");
            refetchHPAs();
        },
        onError: () => toast.error("HPA silinemedi"),
    });

    const deployMutation = useMutation({
        mutationFn: ({ name, image, port, replicas }: { name: string; image: string; port: number; replicas: number }) =>
            k8sApi.deployService(name, image, port, replicas),
        onSuccess: (res, variables) => {
            toast.success(res.message);
            setDeployForms(prev => ({ ...prev, [variables.name]: { ...(prev[variables.name] ?? { image: "", replicas: 1, open: false }), open: false } }));
            queryClient.invalidateQueries({ queryKey: ["k8s-deployments-list"] });
        },
        onError: (err: unknown) => {
            const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(apiMsg ?? "Deploy işlemi başarısız — backend hatası");
        },
    });

    const undeployMutation = useMutation({
        mutationFn: (name: string) => k8sApi.undeployService(name),
        onSuccess: (res) => {
            toast.success(res.message);
            queryClient.invalidateQueries({ queryKey: ["k8s-deployments-list"] });
        },
        onError: (err: unknown) => {
            const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(apiMsg ?? "Kaldırma işlemi başarısız");
        },
    });

    // Helpers
    const pods       = allPodsData?.pods ?? [];
    const deployments = deploymentsData?.deployments ?? [];
    const nodes      = nodesData?.nodes ?? [];
    const hpas       = hpasData?.hpas ?? [];
    const services   = servicesData?.services ?? [];
    const nanonetServices = nanonetServicesData ?? [];

    const slugifyForK8s = (name: string) =>
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const filteredPods = pods.filter(p =>
        !podFilter || p.name.toLowerCase().includes(podFilter.toLowerCase()) ||
        Object.values(p.labels ?? {}).some(v => v.toLowerCase().includes(podFilter.toLowerCase()))
    );
    const runningPods     = pods.filter(p => p.status === "Running").length;
    const readyDeployments = deployments.filter(d => d.ready_replicas === d.replicas && d.replicas > 0).length;
    const readyNodes      = nodes.filter(n => n.ready).length;

    const allEvents = eventsData?.events ?? [];
    const filteredEvents = eventTypeFilter
        ? allEvents.filter(e => e.type === eventTypeFilter)
        : allEvents;
    const warningCount = allEvents.filter(e => e.type === "Warning").length;

    const tabs: { key: TabType; label: string; icon: React.ElementType; colorVar: string; badge?: number }[] = [
        { key: "overview",    label: "Genel Bakış",    icon: Activity, colorVar: "var(--color-teal)" },
        { key: "pods",        label: "Pod'lar",        icon: Box,      colorVar: "var(--color-blue)" },
        { key: "deployments", label: "Deployment'lar", icon: Layers,   colorVar: "var(--color-lavender)" },
        { key: "hpa",         label: "Auto-Scale",     icon: Gauge,    colorVar: "var(--color-pink)" },
        { key: "services",    label: "Servisler",      icon: Share2,   colorVar: "var(--color-teal)" },
        { key: "endpoints",   label: "Endpoints",      icon: Network,  colorVar: "var(--status-warn)" },
        { key: "events",      label: "Events",         icon: Bell,     colorVar: "var(--status-warn)", badge: warningCount },
        { key: "nanonet",     label: "K8s Yayınla",     icon: Package2, colorVar: "var(--color-teal)" },
    ];

    return (
        <div className="space-y-5">
            {/* Log Modal */}
            {logPod && <PodLogModal podName={logPod} onClose={() => setLogPod(null)} />}

            {/* Başlık */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
                            Kubernetes
                        </h1>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            Cluster yönetimi · pod izleme · auto-scaling
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAvailable && (
                            <button
                                onClick={() => { refetchNodes(); refetchAllPods(); refetchDeployments(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all"
                                style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
                            >
                                {(nodesLoading || allPodsLoading || deploymentsLoading)
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <RefreshCw className="w-3 h-3" />}
                                Yenile
                            </button>
                        )}
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border"
                            style={isAvailable
                                ? { background: "var(--status-up-subtle)", borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }
                                : { background: "var(--status-down-subtle)", borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}
                        >
                            {statusLoading
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Kontrol ediliyor</>
                                : isAvailable
                                    ? <><Cloud className="w-3 h-3" /> Aktif · {k8sStatus?.namespace}</>
                                    : <><CloudOff className="w-3 h-3" /> Bağlantısız</>}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Bağlanamadı */}
            {!statusLoading && !isAvailable && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--status-warn-border)" }}>
                        <CloudOff className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--status-warn)" }} />
                        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Kubernetes Entegrasyonu Aktif Değil</h3>
                        <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                            Backend'de <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface-sunken)" }}>K8S_NAMESPACE</code> değişkenini
                            tanımlayın ve backend container'ını yeniden başlatın.
                        </p>
                    </Card>
                </motion.div>
            )}

            {isAvailable && (
                <>
                    {/* Tabs */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                                    style={activeTab === tab.key
                                        ? { background: `color-mix(in srgb, ${tab.colorVar} 14%, transparent)`, borderColor: `color-mix(in srgb, ${tab.colorVar} 35%, transparent)`, color: tab.colorVar }
                                        : { color: "var(--text-muted)", borderColor: "transparent", background: "transparent" }}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                                            style={{ background: "var(--status-warn-subtle)", color: "var(--status-warn-text)", border: "1px solid var(--status-warn-border)" }}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {/* ── OVERVIEW TAB ── */}
                        {activeTab === "overview" && (
                            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <StatCard label="Node'lar" value={`${readyNodes}/${nodes.length}`} icon={Server} color="var(--color-teal)" sub="Ready / Total" />
                                    <StatCard label="Pod'lar" value={`${runningPods}/${pods.length}`} icon={Box} color="var(--color-blue)" sub="Running / Total" />
                                    <StatCard label="Deployment'lar" value={`${readyDeployments}/${deployments.length}`} icon={Layers} color="var(--color-lavender)" sub="Ready / Total" />
                                    <StatCard label="Namespace" value={k8sStatus?.namespace ?? "—"} icon={GitBranch} color="var(--color-pink)" />
                                </div>

                                {/* Nodes */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Nodes</p>
                                    {nodesLoading ? (
                                        <div className="flex items-center gap-2 py-4" style={{ color: "var(--text-faint)" }}>
                                            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Yükleniyor...</span>
                                        </div>
                                    ) : nodes.length === 0 ? (
                                        <Card className="p-5 text-center rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Node bulunamadı</p>
                                        </Card>
                                    ) : (
                                        <div className="space-y-2">
                                            {nodes.map((node) => (
                                                <Card key={node.name} className="rounded-xl overflow-hidden" style={{ background: "var(--surface-glass)", border: `1px solid ${node.ready ? "var(--color-teal-border)" : "var(--status-down-border)"}` }}>
                                                    <button
                                                        className="w-full p-4 flex items-center gap-3 text-left"
                                                        onClick={() => setExpandedNode(expandedNode === node.name ? null : node.name)}
                                                    >
                                                        <StatusDot ready={node.ready} size="md" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>{node.name}</p>
                                                            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                                {node.roles.join(", ")} · {node.version}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className="hidden sm:flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                                <Cpu className="w-3 h-3" />{node.cpu} CPU
                                                            </div>
                                                            <div className="hidden sm:flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                                <MemoryStick className="w-3 h-3" />{MemoryToGB(node.memory)}
                                                            </div>
                                                            <Badge className="text-[9px] px-2 py-0.5 rounded-full border"
                                                                style={node.ready
                                                                    ? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
                                                                    : { background: "var(--status-down-subtle)", color: "var(--status-down-text)", borderColor: "var(--status-down-border)" }}>
                                                                {node.status}
                                                            </Badge>
                                                            {expandedNode === node.name
                                                                ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
                                                                : <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />}
                                                        </div>
                                                    </button>
                                                    <AnimatePresence>
                                                        {expandedNode === node.name && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.2 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                                                                    {[
                                                                        { label: "OS", value: node.os },
                                                                        { label: "Arch", value: node.arch },
                                                                        { label: "CPU", value: node.cpu },
                                                                        { label: "Memory", value: MemoryToGB(node.memory) },
                                                                    ].map(({ label, value }) => (
                                                                        <div key={label} className="pt-3">
                                                                            <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</p>
                                                                            <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{value}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Recent deployments summary */}
                                {deployments.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Deployment'lar</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {deployments.slice(0, 6).map((dep) => {
                                                const healthy = dep.ready_replicas === dep.replicas && dep.replicas > 0;
                                                return (
                                                    <Card key={dep.name} className="p-3 rounded-xl flex items-center gap-3"
                                                        style={{ background: "var(--surface-glass)", border: `1px solid ${healthy ? "var(--color-lavender-border)" : "var(--status-warn-border)"}` }}>
                                                        <StatusDot ready={healthy} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>{dep.name}</p>
                                                            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{dep.strategy || "RollingUpdate"}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold" style={{ color: healthy ? "var(--status-up)" : "var(--status-warn)" }}>
                                                                {dep.ready_replicas}/{dep.replicas}
                                                            </p>
                                                            <p className="text-[9px]" style={{ color: "var(--text-faint)" }}>ready</p>
                                                        </div>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── PODS TAB ── */}
                        {activeTab === "pods" && (
                            <motion.div key="pods" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
                                        <Input
                                            placeholder="Pod adı veya label'a göre filtrele..."
                                            value={podFilter}
                                            onChange={(e) => setPodFilter(e.target.value)}
                                            className="rounded-xl text-xs h-9 pl-8"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => refetchAllPods()}
                                        disabled={allPodsLoading}
                                        className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs border transition-all"
                                        style={{ borderColor: "var(--color-blue-border)", color: "var(--color-blue)" }}
                                    >
                                        {allPodsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    </button>
                                </div>

                                {allPodsLoading && pods.length === 0 ? (
                                    <div className="flex items-center gap-2 py-6" style={{ color: "var(--text-faint)" }}>
                                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Pod'lar yükleniyor...</span>
                                    </div>
                                ) : filteredPods.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                            {filteredPods.length} pod {podFilter && `(filtrelendi)`}
                                        </p>
                                        {filteredPods.map((pod, i) => (
                                            <motion.div key={pod.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                                                <Card className="p-3.5 rounded-xl" style={{ background: "var(--surface-glass)", border: `1px solid ${pod.ready ? "var(--color-blue-border)" : pod.status === "Pending" ? "var(--status-warn-border)" : "var(--status-down-border)"}` }}>
                                                    <div className="flex items-center gap-3">
                                                        <StatusDot ready={pod.ready} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{pod.name}</p>
                                                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                                {pod.node && <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{pod.node}</span>}
                                                                {pod.ip && <span className="text-[10px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{pod.ip}</span>}
                                                                {pod.age && <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>⏱ {pod.age}</span>}
                                                                <span className="text-[10px]" style={{ color: pod.ready_count === pod.container_count && pod.container_count > 0 ? "var(--status-up)" : "var(--status-warn-text)" }}>
                                                                    ▣ {pod.ready_count ?? 0}/{pod.container_count ?? 1}
                                                                </span>
                                                                {pod.restarts > 0 && (
                                                                    <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: "var(--status-warn-text)" }}>
                                                                        <AlertTriangle className="w-3 h-3" />↺ {pod.restarts}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <PodStatusBadge status={pod.status} />
                                                        <button
                                                            onClick={() => setLogPod(pod.name)}
                                                            title="Log'ları Görüntüle"
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                                                            style={{ background: "var(--color-blue-subtle)", border: "1px solid var(--color-blue-border)", color: "var(--color-blue)" }}>
                                                            <Terminal className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm(`"${pod.name}" pod'ı silinsin mi? Kubernetes otomatik olarak yeniden başlatacak.`)) deletePodMutation.mutate(pod.name); }}
                                                            title="Pod'u Sil (Yeniden Başlat)"
                                                            aria-label="Delete pod"
                                                            disabled={deletePodMutation.isPending && deletePodMutation.variables === pod.name}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                                                            style={{ background: "color-mix(in srgb, var(--status-down) 10%, transparent)", border: "1px solid var(--status-down-border)", color: "var(--status-down-text)" }}>
                                                            {deletePodMutation.isPending && deletePodMutation.variables === pod.name
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <Box className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--color-blue)" }} />
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                            {podFilter ? "Filtrele uyan pod bulunamadı" : "Namespace'de pod yok"}
                                        </p>
                                    </Card>
                                )}
                            </motion.div>
                        )}

                        {/* ── DEPLOYMENTS TAB ── */}
                        {activeTab === "deployments" && (
                            <motion.div key="deployments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                        {deployments.length} deployment
                                    </p>
                                    <button
                                        onClick={() => refetchDeployments()}
                                        disabled={deploymentsLoading}
                                        className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border"
                                        style={{ borderColor: "var(--color-lavender-border)", color: "var(--color-lavender)" }}
                                    >
                                        {deploymentsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        Yenile
                                    </button>
                                </div>

                                {deploymentsLoading && deployments.length === 0 ? (
                                    <div className="flex items-center gap-2 py-4" style={{ color: "var(--text-faint)" }}>
                                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Yükleniyor...</span>
                                    </div>
                                ) : deployments.length === 0 ? (
                                    <Card className="p-8 text-center rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--color-lavender)" }} />
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Deployment bulunamadı</p>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        {deployments.map((dep, i) => {
                                            const depReplicas = scaleReplicas[dep.name] ?? dep.replicas;
                                            const healthy = dep.ready_replicas === dep.replicas && dep.replicas > 0;
                                            return (
                                                <motion.div key={dep.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                                    <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: `1px solid ${healthy ? "var(--color-lavender-border)" : "var(--status-warn-border)"}` }}>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--color-lavender-subtle)" }}>
                                                                <Layers className="w-4 h-4" style={{ color: "var(--color-lavender)" }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-secondary)" }}>{dep.name}</p>
                                                                <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{dep.namespace} · {dep.strategy || "RollingUpdate"}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => { if (confirm(`"${dep.name}" deployment'ı yeniden başlatılsın mı? (rolling restart)`)) rolloutRestartMutation.mutate(dep.name); }}
                                                                title="Rollout Restart"
                                                                disabled={rolloutRestartMutation.isPending && rolloutRestartMutation.variables === dep.name}
                                                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                                                                style={{ background: "color-mix(in srgb, var(--color-lavender) 12%, transparent)", border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}>
                                                                {rolloutRestartMutation.isPending && rolloutRestartMutation.variables === dep.name
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <RotateCcw className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-lg font-bold" style={{ color: healthy ? "var(--status-up)" : "var(--status-warn)" }}>
                                                                    {dep.ready_replicas}/{dep.replicas}
                                                                </p>
                                                                <p className="text-[9px]" style={{ color: "var(--text-faint)" }}>ready</p>
                                                            </div>
                                                        </div>

                                                        {/* Replica bar */}
                                                        <div className="mb-4">
                                                            <div className="flex justify-between text-[9px] mb-1" style={{ color: "var(--text-faint)" }}>
                                                                <span>Available: {dep.available_replicas}</span>
                                                                <span>Updated: {dep.updated_replicas}</span>
                                                            </div>
                                                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
                                                                <div className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: dep.replicas > 0 ? `${(dep.ready_replicas / dep.replicas) * 100}%` : "0%",
                                                                        background: healthy ? "var(--status-up)" : "var(--status-warn)",
                                                                    }} />
                                                            </div>
                                                        </div>

                                                        {/* Scale Controls */}
                                                        <div className="p-3 rounded-xl" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                                                            <p className="text-[9px] uppercase tracking-wider mb-2.5" style={{ color: "var(--text-faint)" }}>Scale</p>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setScaleReplicas(prev => ({ ...prev, [dep.name]: Math.max(0, (prev[dep.name] ?? dep.replicas) - 1) }))}
                                                                    aria-label="Decrease replicas"
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}>
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <span className="text-base font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{depReplicas}</span>
                                                                <button
                                                                    onClick={() => setScaleReplicas(prev => ({ ...prev, [dep.name]: Math.min(32, (prev[dep.name] ?? dep.replicas) + 1) }))}
                                                                    aria-label="Increase replicas"
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}>
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                                <div className="flex gap-1 ml-1">
                                                                    {[0, 1, 2, 3, 5, 10].map((n) => (
                                                                        <button key={n}
                                                                            onClick={() => setScaleReplicas(prev => ({ ...prev, [dep.name]: n }))}
                                                                            className="px-2 py-0.5 rounded-lg text-[9px] font-medium border"
                                                                            style={depReplicas === n
                                                                                ? { background: "var(--color-lavender-subtle)", color: "var(--color-lavender)", borderColor: "var(--color-lavender-border)" }
                                                                                : { color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>
                                                                            {n}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <Button
                                                                    onClick={() => scaleMutation.mutate({ name: dep.name, replicas: depReplicas })}
                                                                    disabled={scaleMutation.isPending}
                                                                    className="ml-auto text-white rounded-lg text-[10px] h-7 px-3"
                                                                    style={{ background: "var(--color-lavender)" }}
                                                                >
                                                                    {scaleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Uygula</>}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── HPA TAB ── */}
                        {activeTab === "hpa" && (
                            <motion.div key="hpa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                {/* Existing HPAs list */}
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                        {hpas.length} HPA {hpasLoading && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                                    </p>
                                    <button onClick={() => refetchHPAs()} disabled={hpasLoading}
                                        className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border"
                                        style={{ borderColor: "var(--color-pink-border)", color: "var(--color-pink)" }}>
                                        <RefreshCw className="w-3.5 h-3.5" />Yenile
                                    </button>
                                </div>

                                {hpas.length > 0 && (
                                    <div className="space-y-2">
                                        {hpas.map((hpa) => (
                                            <Card key={hpa.name} className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Gauge className="w-4 h-4 shrink-0" style={{ color: "var(--color-pink)" }} />
                                                        <div>
                                                            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{hpa.name}</p>
                                                            {hpa.deployment_name && (
                                                                <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>→ {hpa.deployment_name}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => { setHpaDeployment(hpa.deployment_name ?? hpa.name); setHpaMin(hpa.min_replicas); setHpaMax(hpa.max_replicas); setHpaCpu(hpa.cpu_target_percent ?? 70); }}
                                                            title="Düzenle"
                                                            aria-label="Configure HPA settings"
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                            style={{ background: "var(--color-pink-subtle)", border: "1px solid var(--color-pink-border)", color: "var(--color-pink)" }}>
                                                            <Settings2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm(`"${hpa.name}" HPA silinsin mi?`)) deleteHPAMutation.mutate(hpa.deployment_name ?? hpa.name); }}
                                                            disabled={deleteHPAMutation.isPending}
                                                            title="Sil"
                                                            aria-label="Delete HPA"
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                            style={{ background: "color-mix(in srgb, var(--status-down) 10%, transparent)", border: "1px solid var(--status-down-border)", color: "var(--status-down-text)" }}>
                                                            {deleteHPAMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 mb-2">
                                                    {[
                                                        { label: "Min", value: hpa.min_replicas },
                                                        { label: "Max", value: hpa.max_replicas },
                                                        { label: "Mevcut", value: hpa.current_replicas },
                                                        { label: "İstenen", value: hpa.desired_replicas },
                                                    ].map((s) => (
                                                        <div key={s.label} className="p-2 rounded-lg text-center" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                                                            <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-faint)" }}>{s.label}</p>
                                                            <p className="text-lg font-bold" style={{ color: "var(--color-pink)" }}>{s.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {hpa.cpu_target_percent && (
                                                    <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                        CPU hedef: <span style={{ color: "var(--color-pink)" }}>%{hpa.cpu_target_percent}</span>
                                                        {hpa.cpu_current_percent !== undefined && <> · mevcut: <span style={{ color: hpa.cpu_current_percent > hpa.cpu_target_percent ? "var(--status-down-text)" : "var(--status-up)" }}>%{hpa.cpu_current_percent}</span></>}
                                                    </div>
                                                )}
                                                {(hpa.max_replicas > 0) && (
                                                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${Math.min(100, (hpa.current_replicas / hpa.max_replicas) * 100)}%`,
                                                                background: "var(--color-pink)",
                                                            }} />
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Create / Update HPA form */}
                                <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings2 className="w-4 h-4" style={{ color: "var(--color-pink)" }} />
                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>HPA Oluştur / Güncelle</h3>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Deployment Seç</p>
                                        {deployments.length > 0 ? (
                                            <Select value={hpaDeployment} onValueChange={setHpaDeployment}>
                                                <SelectTrigger className="rounded-lg text-xs h-9" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                                                    <SelectValue placeholder="Deployment seçin..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {deployments.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                placeholder="Deployment adı (örn: my-app)"
                                                value={hpaDeployment}
                                                onChange={(e) => setHpaDeployment(e.target.value)}
                                                className="rounded-lg text-xs h-9"
                                                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            />
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        {[
                                            { label: "Min Replica", val: hpaMin, set: setHpaMin, min: 1, max: 99 },
                                            { label: "Max Replica", val: hpaMax, set: setHpaMax, min: hpaMin, max: 100 },
                                        ].map(({ label, val, set, min, max }) => (
                                            <div key={label}>
                                                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => set(Math.max(min, val - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                        style={{ border: "1px solid var(--color-pink-border)", color: "var(--color-pink)" }}><Minus className="w-3 h-3" /></button>
                                                    <span className="text-lg font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{val}</span>
                                                    <button onClick={() => set(Math.min(max, val + 1))} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                        style={{ border: "1px solid var(--color-pink-border)", color: "var(--color-pink)" }}><Plus className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>CPU Hedef (%)</p>
                                            <Input type="number" value={hpaCpu} onChange={(e) => setHpaCpu(Number(e.target.value))}
                                                min={10} max={95} className="rounded-lg text-xs h-9"
                                                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl text-[10px] leading-relaxed mb-4"
                                        style={{ background: "color-mix(in srgb, var(--color-pink) 8%, transparent)", border: "1px solid var(--color-pink-border)", color: "var(--text-muted)" }}>
                                        CPU kullanımı <strong style={{ color: "var(--color-pink)" }}>%{hpaCpu}</strong>'in üzerine çıktığında replica sayısı
                                        otomatik olarak <strong>{hpaMin}</strong>–<strong>{hpaMax}</strong> arasında ayarlanır.
                                    </div>

                                    <Button onClick={() => hpaMutation.mutate()} disabled={hpaMutation.isPending || !hpaDeployment}
                                        className="w-full text-white rounded-xl h-9 text-sm" style={{ background: "var(--color-pink)" }}>
                                        {hpaMutation.isPending
                                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Oluşturuluyor...</>
                                            : <><Gauge className="w-4 h-4 mr-2" />HPA Uygula</>}
                                    </Button>
                                </Card>
                            </motion.div>
                        )}

                        {/* ── SERVICES TAB ── */}
                        {activeTab === "services" && (
                            <motion.div key="services" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                        {services.length} service {servicesLoading && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                                    </p>
                                    <button onClick={() => refetchServices()} disabled={servicesLoading}
                                        className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border"
                                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                                        <RefreshCw className="w-3.5 h-3.5" />Yenile
                                    </button>
                                </div>
                                {servicesLoading && services.length === 0 ? (
                                    <div className="flex items-center gap-2 py-6" style={{ color: "var(--text-faint)" }}>
                                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Service'lar yükleniyor...</span>
                                    </div>
                                ) : services.length > 0 ? (
                                    <div className="space-y-2">
                                        {services.map((svc) => (
                                            <Card key={svc.name} className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Globe className="w-4 h-4 shrink-0" style={{ color: "var(--status-up)" }} />
                                                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{svc.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <ServiceTypeBadge type={svc.type} />
                                                        {svc.age && <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>⏱ {svc.age}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                    {svc.cluster_ip && (
                                                        <span>ClusterIP: <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{svc.cluster_ip}</span></span>
                                                    )}
                                                    {svc.external_ip && svc.external_ip !== "<none>" && svc.external_ip !== "" && (
                                                        <span>ExternalIP: <span style={{ color: "var(--status-up)", fontFamily: "var(--font-mono)" }}>{svc.external_ip}</span></span>
                                                    )}
                                                    {svc.namespace && (
                                                        <span>NS: <span style={{ color: "var(--text-muted)" }}>{svc.namespace}</span></span>
                                                    )}
                                                </div>
                                                {svc.ports && svc.ports.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {svc.ports.map((port, pi) => (
                                                            <span key={pi} className="px-2 py-0.5 rounded-md text-[10px] font-mono"
                                                                style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                                                                {port}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {svc.selector && Object.keys(svc.selector).length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {Object.entries(svc.selector).map(([k, v]) => (
                                                            <span key={k} className="px-2 py-0.5 rounded-md text-[10px]"
                                                                style={{ background: "color-mix(in srgb, var(--status-up) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--status-up) 20%, transparent)", color: "var(--status-up)" }}>
                                                                {k}={v}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--text-faint)" }} />
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Namespace'de service bulunamadı</p>
                                    </Card>
                                )}
                            </motion.div>
                        )}

                        {/* ── ENDPOINTS TAB ── */}
                        {activeTab === "endpoints" && (
                            <motion.div key="endpoints" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                    <div className="flex items-center gap-2">
                                        {services.length > 0 ? (
                                            <Select value={endpointName} onValueChange={setEndpointName}>
                                                <SelectTrigger className="rounded-lg text-xs h-9 flex-1" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                                                    <SelectValue placeholder="Service seçin..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {services.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                placeholder="K8s Service adı (örn: my-service)"
                                                value={endpointName}
                                                onChange={(e) => setEndpointName(e.target.value)}
                                                className="rounded-lg text-xs h-9 flex-1"
                                                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                                onKeyDown={(e) => { if (e.key === "Enter") refetchEndpoints(); }}
                                            />
                                        )}
                                        <Button onClick={() => refetchEndpoints()} disabled={!endpointName || endpointsLoading}
                                            size="sm" className="text-white rounded-lg h-9 px-3" style={{ background: "var(--gradient-btn-primary)" }}>
                                            {endpointsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {endpointsData && (
                                    <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Network className="w-4 h-4" style={{ color: "var(--status-warn)" }} />
                                            <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{endpointsData.service}</h3>
                                            <Badge className="text-[9px] px-2 py-0.5 rounded-full border ml-auto"
                                                style={{ background: "color-mix(in srgb, var(--status-warn) 10%, transparent)", color: "var(--status-warn-text)", borderColor: "var(--status-warn-border)" }}>
                                                {endpointsData.count} endpoint
                                            </Badge>
                                        </div>
                                        {endpointsData.endpoints.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {endpointsData.endpoints.map((ep, i) => (
                                                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "var(--surface-sunken)" }}>
                                                        <HardDrive className="w-3 h-3 shrink-0" style={{ color: "var(--status-up)" }} />
                                                        <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{ep}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-center py-4" style={{ color: "var(--text-faint)" }}>Aktif endpoint bulunamadı</p>
                                        )}
                                    </Card>
                                )}
                            </motion.div>
                        )}

                        {/* ── EVENTS TAB ── */}
                        {activeTab === "events" && (
                            <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        {(["" , "Warning", "Normal"] as const).map((t) => (
                                            <button key={t || "all"} onClick={() => setEventTypeFilter(t)}
                                                className="px-3 py-1.5 rounded-xl text-xs border transition-all"
                                                style={eventTypeFilter === t
                                                    ? t === "Warning"
                                                        ? { background: "var(--status-warn-subtle)", borderColor: "var(--status-warn-border)", color: "var(--status-warn-text)" }
                                                        : t === "Normal"
                                                            ? { background: "var(--status-up-subtle)", borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }
                                                            : { background: "color-mix(in srgb, var(--color-blue) 12%, transparent)", borderColor: "var(--color-blue-border)", color: "var(--color-blue)" }
                                                    : { color: "var(--text-muted)", borderColor: "var(--border-subtle)", background: "transparent" }}>
                                                {t === "" ? "Tümü" : t}
                                            </button>
                                        ))}
                                    </div>
                                    <Select value={eventKindFilter} onValueChange={setEventKindFilter}>
                                        <SelectTrigger className="rounded-xl text-xs h-8 w-36" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                                            <SelectValue placeholder="Kind: Tümü" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Kind: Tümü</SelectItem>
                                            <SelectItem value="Pod">Pod</SelectItem>
                                            <SelectItem value="Deployment">Deployment</SelectItem>
                                            <SelectItem value="ReplicaSet">ReplicaSet</SelectItem>
                                            <SelectItem value="Node">Node</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <button onClick={() => refetchEvents()} disabled={eventsLoading}
                                        className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border ml-auto"
                                        style={{ borderColor: "var(--status-warn-border)", color: "var(--status-warn-text)" }}>
                                        {eventsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        Yenile
                                    </button>
                                </div>

                                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                    {filteredEvents.length} event
                                    {warningCount > 0 && <span className="ml-2" style={{ color: "var(--status-warn-text)" }}>⚠ {warningCount} uyarı</span>}
                                </p>

                                {eventsLoading && allEvents.length === 0 ? (
                                    <div className="flex items-center gap-2 py-6" style={{ color: "var(--text-faint)" }}>
                                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Event'ler yükleniyor...</span>
                                    </div>
                                ) : filteredEvents.length === 0 ? (
                                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--text-faint)" }} />
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Event bulunamadı</p>
                                    </Card>
                                ) : (
                                    <div className="space-y-1.5">
                                        {filteredEvents.map((ev: EventInfo, i: number) => (
                                            <motion.div key={ev.name + i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                                                <Card className="px-4 py-3 rounded-xl" style={{
                                                    background: "var(--surface-glass)",
                                                    border: `1px solid ${ev.type === "Warning" ? "var(--status-warn-border)" : "var(--border-subtle)"}`
                                                }}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 shrink-0">
                                                            {ev.type === "Warning"
                                                                ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--status-warn)" }} />
                                                                : <Activity className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-semibold" style={{ color: ev.type === "Warning" ? "var(--status-warn-text)" : "var(--text-secondary)" }}>
                                                                    {ev.reason}
                                                                </span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--surface-sunken)", color: "var(--text-faint)" }}>
                                                                    {ev.kind}/{ev.object}
                                                                </span>
                                                                {ev.count > 1 && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--status-warn) 12%, transparent)", color: "var(--status-warn-text)" }}>
                                                                        ×{ev.count}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{ev.message}</p>
                                                        </div>
                                                        {ev.age && (
                                                            <span className="text-[10px] shrink-0" style={{ color: "var(--text-faint)" }}>{ev.age}</span>
                                                        )}
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── NANONET SERVİSLERİ → K8S ── */}
                        {activeTab === "nanonet" && (
                            <motion.div key="nanonet" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>NanoNet Servisleri</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                                            Agent tarafından izlenen servisleri K8s cluster'ına dahil edin veya çıkarın
                                        </p>
                                    </div>
                                    <button onClick={() => { refetchNanonetServices(); refetchDeployments(); }} disabled={nanonetServicesLoading}
                                        className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border"
                                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                                        {nanonetServicesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        Yenile
                                    </button>
                                </div>

                                {!isAvailable && (
                                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs"
                                        style={{ background: "var(--status-warn-subtle)", border: "1px solid var(--status-warn-border)", color: "var(--status-warn-text)" }}>
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>Kubernetes bağlantısı yok — K8s'e dağıtmak için backend'de <code className="px-1 py-0.5 rounded font-mono text-[10px]" style={{ background: "color-mix(in srgb, var(--status-warn) 15%, transparent)" }}>K8S_NAMESPACE</code> değişkenini tanımlayın.</span>
                                    </div>
                                )}

                                {nanonetServicesLoading && nanonetServices.length === 0 ? (
                                    <div className="flex items-center gap-2 py-6" style={{ color: "var(--text-faint)" }}>
                                        <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Servisler yükleniyor...</span>
                                    </div>
                                ) : nanonetServices.length === 0 ? (
                                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                        <Package2 className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--text-faint)" }} />
                                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-muted)" }}>Henüz servis yok</p>
                                        <p className="text-xs" style={{ color: "var(--text-faint)" }}>Agent bağlandıktan sonra izlenen servisler burada görünür</p>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        {nanonetServices.map((svc: Service) => {
                                            const slug = slugifyForK8s(svc.name);
                                            const isDeployed = deployments.some(d => d.name === slug);
                                            const form = deployForms[svc.name] ?? { image: "", replicas: 1, open: false };
                                            const isDeploying = deployMutation.isPending && (deployMutation.variables as {name:string})?.name === svc.name;
                                            const isUndeploying = undeployMutation.isPending && undeployMutation.variables === svc.name;

                                            return (
                                                <motion.div key={svc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                                                    <Card className="p-4 rounded-xl" style={{
                                                        background: "var(--surface-glass)",
                                                        border: `1px solid ${isDeployed ? "var(--color-teal-border)" : "var(--border-subtle)"}`,
                                                    }}>
                                                        {/* Header row */}
                                                        <div className="flex items-center gap-3">
                                                            <StatusDot ready={svc.status === "up"} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>{svc.name}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                                                                    {svc.host}:{svc.port}
                                                                </p>
                                                            </div>

                                                            {/* K8s deployment status */}
                                                            {isDeployed ? (
                                                                <Badge className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
                                                                    style={{ background: "var(--color-teal-subtle)", color: "var(--color-teal)", borderColor: "var(--color-teal-border)" }}>
                                                                    <PackageCheck className="w-3 h-3 inline mr-1" />K8s'te
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="text-[9px] px-2 py-0.5 rounded-full border shrink-0"
                                                                    style={{ background: "var(--surface-sunken)", color: "var(--text-faint)", borderColor: "var(--border-subtle)" }}>
                                                                    K8s dışı
                                                                </Badge>
                                                            )}

                                                            {/* Action buttons */}
                                                            {isDeployed ? (
                                                                <button
                                                                    onClick={() => { if (confirm(`"${svc.name}" K8s'ten kaldırılsın mı? (Deployment + Service + HPA silinir)`)) undeployMutation.mutate(svc.name); }}
                                                                    disabled={isUndeploying}
                                                                    className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] border shrink-0 transition-opacity hover:opacity-80"
                                                                    style={{ background: "color-mix(in srgb, var(--status-down) 10%, transparent)", borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}>
                                                                    {isUndeploying
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <PackageX className="w-3 h-3" />}
                                                                    K8s'ten Çıkar
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setDeployForms(prev => ({ ...prev, [svc.name]: { ...form, open: !form.open } }))}
                                                                    className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] border shrink-0 transition-all"
                                                                    style={form.open
                                                                        ? { background: "var(--color-teal-subtle)", borderColor: "var(--color-teal-border)", color: "var(--color-teal)" }
                                                                        : { borderColor: "var(--color-teal-border)", color: "var(--color-teal)" }}>
                                                                    <Package2 className="w-3 h-3" />
                                                                    K8s'e Dahil Et
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* K8s slug info for deployed */}
                                                        {isDeployed && (
                                                            <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                                <span>K8s adı:</span>
                                                                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-teal)" }}>{slug}</span>
                                                                {deployments.find(d => d.name === slug) && (() => {
                                                                    const dep = deployments.find(d => d.name === slug)!;
                                                                    return (
                                                                        <span style={{ color: dep.ready_replicas === dep.replicas && dep.replicas > 0 ? "var(--status-up)" : "var(--status-warn)" }}>
                                                                            · {dep.ready_replicas}/{dep.replicas} ready
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}

                                                        {/* Deploy form (expandable) */}
                                                        {!isDeployed && form.open && (
                                                            <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Container İmajı <span style={{ color: "var(--color-red, #e57373)" }}>*</span></p>
                                                                    <Input
                                                                        placeholder={`nginx:latest, my-registry/${slug}:latest`}
                                                                        value={form.image}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setDeployForms(prev => ({ ...prev, [svc.name]: { ...(prev[svc.name] ?? { image: "", replicas: 1, open: true }), image: val } }));
                                                                        }}
                                                                        className="rounded-lg text-xs h-9"
                                                                        style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
                                                                    />
                                                                    {!form.image.trim() && (
                                                                        <p className="text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
                                                                            Dağıtım için bir container imajı girin (örn: nginx:latest)
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-end gap-3">
                                                                    <div>
                                                                        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Replica</p>
                                                                        <div className="flex items-center gap-2">
                                                                            <button onClick={() => setDeployForms(prev => ({ ...prev, [svc.name]: { ...(prev[svc.name] ?? { image: "", replicas: 1, open: true }), replicas: Math.max(1, (prev[svc.name]?.replicas ?? 1) - 1) } }))
}
                                                                                aria-label="Decrease replicas"
                                                                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                                style={{ border: "1px solid var(--color-teal-border)", color: "var(--color-teal)" }}>
                                                                                <Minus className="w-3 h-3" />
                                                                            </button>
                                                                            <span className="text-base font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{form.replicas}</span>
                                                                            <button onClick={() => setDeployForms(prev => ({ ...prev, [svc.name]: { ...(prev[svc.name] ?? { image: "", replicas: 1, open: true }), replicas: Math.min(20, (prev[svc.name]?.replicas ?? 1) + 1) } }))
}
                                                                                aria-label="Increase replicas"
                                                                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                                style={{ border: "1px solid var(--color-teal-border)", color: "var(--color-teal)" }}>
                                                                                <Plus className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => deployMutation.mutate({ name: svc.name, image: form.image, port: svc.port, replicas: form.replicas })}
                                                                        disabled={!form.image.trim() || isDeploying || !isAvailable}
                                                                        title={!isAvailable ? "K8s bağlantısı yok" : !form.image.trim() ? "Container imajı gerekli" : ""}
                                                                        className="flex-1 text-white rounded-xl h-9 text-xs"
                                                                        style={{ background: (!form.image.trim() || isDeploying || !isAvailable) ? "var(--text-faint)" : "var(--color-teal)" }}>
                                                                        {isDeploying
                                                                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Dağıtılıyor...</>
                                                                            : <><Package2 className="w-3.5 h-3.5 mr-1.5" />K8s'e Dağıt</>}
                                                                    </Button>
                                                                </div>
                                                                <div className="text-[10px] px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--color-teal) 8%, transparent)", border: "1px solid var(--color-teal-border)", color: "var(--text-faint)" }}>
                                                                    Deployment + ClusterIP Service oluşturulacak &nbsp;·&nbsp;
                                                                    K8s adı: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-teal)" }}>{slug}</span>
                                                                    &nbsp;·&nbsp; Port: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-teal)" }}>{svc.port}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
