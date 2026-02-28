import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { k8sApi, type PodInfo, type DeploymentInfo, type HPAInfo, type NodeInfo } from "@/api/k8s";

type TabType = "overview" | "pods" | "deployments" | "hpa" | "endpoints";

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

export function KubernetesPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [podFilter, setPodFilter] = useState("");
    const [hpaDeployment, setHpaDeployment] = useState("");
    const [endpointName, setEndpointName] = useState("");
    const [expandedNode, setExpandedNode] = useState<string | null>(null);

    // Scale state
    const [scaleReplicas, setScaleReplicas] = useState<Record<string, number>>({});

    // HPA state
    const [hpaMin, setHpaMin] = useState(1);
    const [hpaMax, setHpaMax] = useState(5);
    const [hpaCpu, setHpaCpu] = useState(70);

    // K8s availability — 30s polling
    const { data: k8sStatus, isLoading: statusLoading } = useQuery({
        queryKey: ["k8s-status"],
        queryFn: k8sApi.getStatus,
        retry: 1,
        refetchInterval: 30000,
    });

    const isAvailable = k8sStatus?.available ?? false;

    // Overview: nodes + all pods + deployments list — 15s polling
    const { data: nodesData, isLoading: nodesLoading, refetch: refetchNodes } = useQuery({
        queryKey: ["k8s-nodes"],
        queryFn: k8sApi.getNodes,
        enabled: isAvailable,
        retry: 1,
        refetchInterval: 15000,
    });

    const { data: allPodsData, isLoading: allPodsLoading, refetch: refetchAllPods } = useQuery({
        queryKey: ["k8s-all-pods"],
        queryFn: k8sApi.getAllPods,
        enabled: isAvailable && (activeTab === "overview" || activeTab === "pods"),
        retry: 1,
        refetchInterval: 15000,
    });

    const { data: deploymentsData, isLoading: deploymentsLoading, refetch: refetchDeployments } = useQuery({
        queryKey: ["k8s-deployments-list"],
        queryFn: k8sApi.listDeployments,
        enabled: isAvailable && (activeTab === "overview" || activeTab === "deployments"),
        retry: 1,
        refetchInterval: 15000,
    });

    // HPA
    const { data: hpaInfo, isLoading: hpaLoading, refetch: refetchHPA } = useQuery({
        queryKey: ["k8s-hpa", hpaDeployment],
        queryFn: () => k8sApi.getHPA(hpaDeployment + "-hpa"),
        enabled: activeTab === "hpa" && !!hpaDeployment,
        retry: 1,
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

    const hpaMutation = useMutation({
        mutationFn: () => k8sApi.createOrUpdateHPA(hpaDeployment, hpaMin, hpaMax, hpaCpu),
        onSuccess: () => {
            toast.success("HPA başarıyla oluşturuldu/güncellendi");
            refetchHPA();
        },
        onError: () => toast.error("HPA işlemi başarısız"),
    });

    const deleteHPAMutation = useMutation({
        mutationFn: (name: string) => k8sApi.deleteHPA(name),
        onSuccess: () => {
            toast.success("HPA silindi");
            refetchHPA();
        },
        onError: () => toast.error("HPA silinemedi"),
    });

    // Helpers
    const pods = allPodsData?.pods ?? [];
    const deployments = deploymentsData?.deployments ?? [];
    const nodes = nodesData?.nodes ?? [];
    const filteredPods = pods.filter(p =>
        !podFilter || p.name.toLowerCase().includes(podFilter.toLowerCase()) ||
        Object.values(p.labels ?? {}).some(v => v.toLowerCase().includes(podFilter.toLowerCase()))
    );
    const runningPods = pods.filter(p => p.status === "Running").length;
    const readyDeployments = deployments.filter(d => d.ready_replicas === d.replicas && d.replicas > 0).length;
    const readyNodes = nodes.filter(n => n.ready).length;

    const tabs = [
        { key: "overview" as const,     label: "Genel Bakış",    icon: Activity,  colorVar: "var(--color-teal)" },
        { key: "pods" as const,         label: "Pod'lar",        icon: Box,       colorVar: "var(--color-blue)" },
        { key: "deployments" as const,  label: "Deployment'lar", icon: Layers,    colorVar: "var(--color-lavender)" },
        { key: "hpa" as const,          label: "Auto-Scale",     icon: Gauge,     colorVar: "var(--color-pink)" },
        { key: "endpoints" as const,    label: "Endpoints",      icon: Network,   colorVar: "var(--status-warn)" },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
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

            {/* Not available */}
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
                                                                {pod.restarts > 0 && (
                                                                    <span className="text-[10px] font-medium" style={{ color: "var(--status-warn-text)" }}>↺ {pod.restarts}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <PodStatusBadge status={pod.status} />
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
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}>
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <span className="text-base font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{depReplicas}</span>
                                                                <button
                                                                    onClick={() => setScaleReplicas(prev => ({ ...prev, [dep.name]: Math.min(32, (prev[dep.name] ?? dep.replicas) + 1) }))}
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}>
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                                <div className="flex gap-1 ml-1">
                                                                    {[1, 2, 3, 5].map((n) => (
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
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                    <p className="text-[10px] uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>Deployment Seç</p>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="Deployment adı (örn: my-app)"
                                            value={hpaDeployment}
                                            onChange={(e) => setHpaDeployment(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchHPA(); }}
                                            list="dep-list"
                                        />
                                        <datalist id="dep-list">
                                            {deployments.map(d => <option key={d.name} value={d.name} />)}
                                        </datalist>
                                        <Button onClick={() => refetchHPA()} disabled={!hpaDeployment || hpaLoading}
                                            size="sm" className="text-white rounded-lg h-9 px-3" style={{ background: "var(--gradient-btn-primary)" }}>
                                            {hpaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {hpaInfo && (
                                    <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Gauge className="w-4 h-4" style={{ color: "var(--color-pink)" }} />
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{hpaInfo.name}</p>
                                                    {hpaInfo.cpu_target_percent && (
                                                        <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                                                            CPU hedef: %{hpaInfo.cpu_target_percent}
                                                            {hpaInfo.cpu_current_percent !== undefined && ` · mevcut: %${hpaInfo.cpu_current_percent}`}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm"
                                                onClick={() => deleteHPAMutation.mutate(hpaDeployment)}
                                                disabled={deleteHPAMutation.isPending}
                                                className="text-[10px] rounded-lg h-7"
                                                style={{ borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}>
                                                {deleteHPAMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3 mr-1" />Sil</>}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: "Min", value: hpaInfo.min_replicas },
                                                { label: "Max", value: hpaInfo.max_replicas },
                                                { label: "Mevcut", value: hpaInfo.current_replicas },
                                                { label: "İstenen", value: hpaInfo.desired_replicas },
                                            ].map((s) => (
                                                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                                                    <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{s.label}</p>
                                                    <p className="text-xl font-bold" style={{ color: "var(--color-pink)" }}>{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings2 className="w-4 h-4" style={{ color: "var(--color-pink)" }} />
                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>HPA Oluştur / Güncelle</h3>
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

                        {/* ── ENDPOINTS TAB ── */}
                        {activeTab === "endpoints" && (
                            <motion.div key="endpoints" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--border-subtle)" }}>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="K8s Service adı (örn: my-service)"
                                            value={endpointName}
                                            onChange={(e) => setEndpointName(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchEndpoints(); }}
                                            list="svc-list"
                                        />
                                        <datalist id="svc-list">
                                            {deployments.map(d => <option key={d.name} value={d.name} />)}
                                        </datalist>
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
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
