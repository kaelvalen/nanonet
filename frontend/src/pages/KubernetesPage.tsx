import { useState, useEffect } from "react";
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
    HardDrive,
    Layers,
    Server,
    BarChart3,
    RefreshCw,
    Plus,
    Minus,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    Cloud,
    CloudOff,
    Trash2,
    Settings2,
    Network,
    Gauge,
} from "lucide-react";
import { k8sApi, type PodInfo, type DeploymentInfo, type HPAInfo } from "@/api/k8s";

type TabType = "pods" | "deployments" | "hpa" | "endpoints";

function StatusDot({ ready }: { ready: boolean }) {
    return (
        <div className="relative shrink-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ready ? "var(--status-up)" : "var(--status-down)" }} />
            {ready && <div className="absolute inset-0 w-2 h-2 rounded-full animate-pulse-ring" style={{ backgroundColor: "var(--status-up)" }} />}
        </div>
    );
}

export function KubernetesPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>("pods");
    const [podSelector, setPodSelector] = useState("app=");
    const [deploymentName, setDeploymentName] = useState("");
    const [hpaDeployment, setHpaDeployment] = useState("");
    const [endpointName, setEndpointName] = useState("");

    // Scale state
    const [scaleTarget, setScaleTarget] = useState("");
    const [scaleReplicas, setScaleReplicas] = useState(1);

    // HPA state
    const [hpaMin, setHpaMin] = useState(1);
    const [hpaMax, setHpaMax] = useState(5);
    const [hpaCpu, setHpaCpu] = useState(70);

    // K8s availability
    const { data: k8sStatus, isLoading: statusLoading } = useQuery({
        queryKey: ["k8s-status"],
        queryFn: k8sApi.getStatus,
        retry: 1,
        staleTime: 30000,
    });

    // Pods
    const { data: podsData, isLoading: podsLoading, refetch: refetchPods } = useQuery({
        queryKey: ["k8s-pods", podSelector],
        queryFn: () => k8sApi.getPods(podSelector),
        enabled: activeTab === "pods" && podSelector.length > 4,
        retry: 1,
    });

    // Deployment
    const { data: deployment, isLoading: deploymentLoading, refetch: refetchDeployment } = useQuery({
        queryKey: ["k8s-deployment", deploymentName],
        queryFn: () => k8sApi.getDeployment(deploymentName),
        enabled: activeTab === "deployments" && !!deploymentName,
        retry: 1,
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
            queryClient.invalidateQueries({ queryKey: ["k8s-deployment"] });
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

    const isAvailable = k8sStatus?.available ?? false;

    const tabs = [
        { key: "pods" as const, label: "Pod'lar", icon: Box, colorVar: "var(--color-teal)" },
        { key: "deployments" as const, label: "Deployment", icon: Layers, colorVar: "var(--color-blue)" },
        { key: "hpa" as const, label: "Auto-Scale (HPA)", icon: Gauge, colorVar: "var(--color-lavender)" },
        { key: "endpoints" as const, label: "Endpoints", icon: Network, colorVar: "var(--color-pink)" },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
                            Kubernetes
                        </h1>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Cluster yönetimi, pod izleme ve auto-scaling</p>
                    </div>
                    <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all"
                        style={isAvailable
                            ? { background: "var(--status-up-subtle)", borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }
                            : { background: "var(--status-down-subtle)", borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}
                    >
                        {statusLoading ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Kontrol ediliyor...</>
                        ) : isAvailable ? (
                            <><Cloud className="w-3 h-3" /> Cluster Aktif ({k8sStatus?.namespace})</>
                        ) : (
                            <><CloudOff className="w-3 h-3" /> Cluster Bağlantısız</>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Not available banner */}
            {!statusLoading && !isAvailable && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="p-6 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--status-warn-border)" }}>
                        <CloudOff className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--status-warn)" }} />
                        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Kubernetes Entegrasyonu Aktif Değil</h3>
                        <p className="text-xs max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                            Backend'de <code className="px-1 rounded" style={{ background: "var(--surface-sunken)" }}>K8S_NAMESPACE</code> environment
                            değişkenini tanımlayarak Kubernetes entegrasyonunu aktifleştirebilirsiniz.
                        </p>
                    </Card>
                </motion.div>
            )}

            {/* Tabs */}
            {isAvailable && (
                <>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                                    style={activeTab === tab.key
                                        ? { background: `color-mix(in srgb, ${tab.colorVar} 12%, transparent)`, borderColor: `color-mix(in srgb, ${tab.colorVar} 30%, transparent)`, color: tab.colorVar }
                                        : { color: "var(--text-muted)", borderColor: "transparent" }}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Pods Tab */}
                    <AnimatePresence mode="wait">
                        {activeTab === "pods" && (
                            <motion.div key="pods" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            placeholder="Label selector (örn: app=my-service)"
                                            value={podSelector}
                                            onChange={(e) => setPodSelector(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchPods(); }}
                                        />
                                        <Button
                                            onClick={() => refetchPods()}
                                            disabled={podSelector.length < 4 || podsLoading}
                                            size="sm"
                                            className="text-white rounded-lg h-9 px-3"
                                            style={{ background: "var(--gradient-btn-primary)" }}
                                        >
                                            {podsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {podsData && podsData.pods.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{podsData.count} pod bulundu</p>
                                        {podsData.pods.map((pod, i) => (
                                            <motion.div key={pod.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: `1px solid ${pod.ready ? "var(--color-teal-border)" : "var(--status-down-border)"}` }}>
                                                    <div className="flex items-center gap-3">
                                                        <StatusDot ready={pod.ready} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold font-(--font-mono) truncate" style={{ color: "var(--text-secondary)" }}>{pod.name}</p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Node: {pod.node}</span>
                                                                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>IP: {pod.ip}</span>
                                                                {pod.restarts > 0 && (
                                                                    <span className="text-[10px]" style={{ color: "var(--status-warn-text)" }}>Restart: {pod.restarts}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Badge className="text-[9px] px-2 py-0.5 rounded-full border"
                                                            style={pod.status === "Running"
                                                                ? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
                                                                : { background: "var(--status-down-subtle)", color: "var(--status-down-text)", borderColor: "var(--status-down-border)" }}>
                                                            {pod.status}
                                                        </Badge>
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : podsData && podsData.pods.length === 0 ? (
                                    <Card className="p-8 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
                                        <Box className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: "var(--color-teal)" }} />
                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Bu selector ile eşleşen pod bulunamadı</p>
                                    </Card>
                                ) : null}
                            </motion.div>
                        )}

                        {/* Deployments Tab */}
                        {activeTab === "deployments" && (
                            <motion.div key="deployments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-blue-border)" }}>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            placeholder="Deployment adı"
                                            value={deploymentName}
                                            onChange={(e) => setDeploymentName(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchDeployment(); }}
                                        />
                                        <Button onClick={() => refetchDeployment()} disabled={!deploymentName || deploymentLoading}
                                            size="sm" className="text-white rounded-lg h-9 px-3" style={{ background: "var(--gradient-btn-primary)" }}>
                                            {deploymentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {deployment && (
                                    <Card className="p-6 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-blue-border)" }}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--color-blue-subtle)" }}>
                                                <Layers className="w-5 h-5" style={{ color: "var(--color-blue)" }} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{deployment.name}</h3>
                                                <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{deployment.namespace} · {deployment.strategy}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                            {[
                                                { label: "İstenen", value: deployment.replicas, iconVar: "var(--color-blue)" },
                                                { label: "Hazır", value: deployment.ready_replicas, iconVar: "var(--status-up)" },
                                                { label: "Kullanılabilir", value: deployment.available_replicas, iconVar: "var(--color-teal)" },
                                                { label: "Güncellenen", value: deployment.updated_replicas, iconVar: "var(--color-lavender)" },
                                            ].map((s) => (
                                                <div key={s.label} className="p-3 rounded-xl" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                                                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{s.label}</p>
                                                    <p className="text-xl font-bold" style={{ color: s.iconVar }}>{s.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Scale Controls */}
                                        <div className="p-4 rounded-xl" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-blue-border)" }}>
                                            <h4 className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Manuel Scale</h4>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => setScaleReplicas(Math.max(0, scaleReplicas - 1))}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                    style={{ border: "1px solid var(--color-blue-border)", color: "var(--color-blue)" }}>
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-xl font-bold w-8 text-center" style={{ color: "var(--text-secondary)" }}>{scaleReplicas}</span>
                                                <button onClick={() => setScaleReplicas(Math.min(32, scaleReplicas + 1))}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                    style={{ border: "1px solid var(--color-blue-border)", color: "var(--color-blue)" }}>
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex gap-1 ml-2">
                                                    {[1, 2, 4, 8].map((n) => (
                                                        <button key={n} onClick={() => setScaleReplicas(n)}
                                                            className="px-2 py-1 rounded-lg text-[10px] font-medium border transition-all"
                                                            style={scaleReplicas === n
                                                                ? { background: "var(--color-blue-subtle)", color: "var(--color-blue)", borderColor: "var(--color-blue-border)" }
                                                                : { color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>{n}x</button>
                                                    ))}
                                                </div>
                                                <Button
                                                    onClick={() => scaleMutation.mutate({ name: deployment.name, replicas: scaleReplicas })}
                                                    disabled={scaleMutation.isPending}
                                                    className="ml-auto text-white rounded-lg text-xs h-8 px-4"
                                                    style={{ background: "var(--color-blue)" }}
                                                >
                                                    {scaleMutation.isPending
                                                        ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Scale Ediliyor</>
                                                        : <><Layers className="w-3 h-3 mr-1" /> Scale Et</>}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )}
                            </motion.div>
                        )}

                        {/* HPA Tab */}
                        {activeTab === "hpa" && (
                            <motion.div key="hpa" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            placeholder="Deployment adı (HPA hedefi)"
                                            value={hpaDeployment}
                                            onChange={(e) => setHpaDeployment(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchHPA(); }}
                                        />
                                        <Button onClick={() => refetchHPA()} disabled={!hpaDeployment || hpaLoading}
                                            size="sm" className="text-white rounded-lg h-9 px-3" style={{ background: "var(--gradient-btn-primary)" }}>
                                            {hpaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {/* Existing HPA info */}
                                {hpaInfo && (
                                    <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Gauge className="w-4 h-4" style={{ color: "var(--color-lavender)" }} />
                                                <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Mevcut HPA: {hpaInfo.name}</h3>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => deleteHPAMutation.mutate(hpaDeployment)}
                                                disabled={deleteHPAMutation.isPending}
                                                className="text-[10px] rounded-lg h-7"
                                                style={{ borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}>
                                                <Trash2 className="w-3 h-3 mr-1" /> Sil
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { label: "Min", value: hpaInfo.min_replicas, colorVar: "var(--color-lavender)" },
                                                { label: "Max", value: hpaInfo.max_replicas, colorVar: "var(--color-lavender)" },
                                                { label: "Mevcut", value: hpaInfo.current_replicas, colorVar: "var(--color-blue)" },
                                                { label: "İstenen", value: hpaInfo.desired_replicas, colorVar: "var(--status-up)" },
                                            ].map((s) => (
                                                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
                                                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{s.label}</p>
                                                    <p className="text-xl font-bold" style={{ color: s.colorVar }}>{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {hpaInfo.cpu_target_percent && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <Cpu className="w-3 h-3" style={{ color: "var(--color-lavender)" }} />
                                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                                    CPU Hedef: %{hpaInfo.cpu_target_percent}
                                                    {hpaInfo.cpu_current_percent !== undefined && ` · Mevcut: %${hpaInfo.cpu_current_percent}`}
                                                </span>
                                            </div>
                                        )}
                                    </Card>
                                )}

                                {/* Create/Update HPA */}
                                <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings2 className="w-4 h-4" style={{ color: "var(--color-lavender)" }} />
                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>HPA Oluştur / Güncelle</h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>Min Replica</label>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setHpaMin(Math.max(1, hpaMin - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}><Minus className="w-3 h-3" /></button>
                                                <span className="text-lg font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{hpaMin}</span>
                                                <button onClick={() => setHpaMin(hpaMin + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}><Plus className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>Max Replica</label>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setHpaMax(Math.max(hpaMin, hpaMax - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}><Minus className="w-3 h-3" /></button>
                                                <span className="text-lg font-bold w-6 text-center" style={{ color: "var(--text-secondary)" }}>{hpaMax}</span>
                                                <button onClick={() => setHpaMax(hpaMax + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ border: "1px solid var(--color-lavender-border)", color: "var(--color-lavender)" }}><Plus className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>CPU Hedef (%)</label>
                                            <Input type="number" value={hpaCpu} onChange={(e) => setHpaCpu(Number(e.target.value))}
                                                min={10} max={95}
                                                className="rounded-lg text-xs h-9"
                                                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl text-[10px] leading-relaxed mb-4" style={{ background: "var(--color-lavender-subtle)", border: "1px solid var(--color-lavender-border)", color: "var(--text-muted)" }}>
                                        CPU kullanımı <strong>%{hpaCpu}</strong>'in üzerine çıktığında pod sayısı otomatik olarak <strong>{hpaMin}</strong> ile <strong>{hpaMax}</strong> arasında artırılır.
                                    </div>

                                    <Button
                                        onClick={() => hpaMutation.mutate()}
                                        disabled={hpaMutation.isPending || !hpaDeployment}
                                        className="w-full text-white rounded-xl h-9 text-sm"
                                        style={{ background: "var(--color-lavender)" }}
                                    >
                                        {hpaMutation.isPending
                                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Oluşturuluyor...</>
                                            : <><Gauge className="w-4 h-4 mr-2" /> HPA Uygula</>}
                                    </Button>
                                </Card>
                            </motion.div>
                        )}

                        {/* Endpoints Tab */}
                        {activeTab === "endpoints" && (
                            <motion.div key="endpoints" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            placeholder="Service adı"
                                            value={endpointName}
                                            onChange={(e) => setEndpointName(e.target.value)}
                                            className="rounded-lg text-xs h-9 flex-1"
                                            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                                            onKeyDown={(e) => { if (e.key === "Enter") refetchEndpoints(); }}
                                        />
                                        <Button onClick={() => refetchEndpoints()} disabled={!endpointName || endpointsLoading}
                                            size="sm" className="text-white rounded-lg h-9 px-3" style={{ background: "var(--gradient-btn-primary)" }}>
                                            {endpointsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                    </div>
                                </Card>

                                {endpointsData && (
                                    <Card className="p-5 rounded-xl" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-pink-border)" }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Network className="w-4 h-4" style={{ color: "var(--color-pink)" }} />
                                            <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{endpointsData.service}</h3>
                                            <Badge className="text-[9px] px-1.5 py-0.5 rounded-full border ml-auto"
                                                style={{ background: "var(--color-pink-subtle)", color: "var(--color-pink)", borderColor: "var(--color-pink-border)" }}>
                                                {endpointsData.count} endpoint
                                            </Badge>
                                        </div>
                                        {endpointsData.endpoints.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {endpointsData.endpoints.map((ep, i) => (
                                                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--surface-sunken)" }}>
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--status-up)" }} />
                                                        <span className="text-xs font-(--font-mono)" style={{ color: "var(--text-secondary)" }}>{ep}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-center py-4" style={{ color: "var(--text-faint)" }}>Endpoint bulunamadı</p>
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
