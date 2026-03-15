import React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Loader2, RefreshCw, AlertTriangle, Terminal, Trash2, Box } from "lucide-react";
import type { PodInfo } from "@/api/k8s";

export interface PodsTabProps {
    podFilter: string;
    setPodFilter: (filter: string) => void;
    refetchAllPods: () => void;
    allPodsLoading: boolean;
    pods: PodInfo[];
    filteredPods: PodInfo[];
    setLogPod: (name: string | null) => void;
    deletePodMutation: any;
    PodStatusBadge: React.FC<{ status: string }>;
    StatusDot: React.FC<{ ready: boolean; size?: "sm" | "md" }>;
}

export function PodsTab({
    podFilter,
    setPodFilter,
    refetchAllPods,
    allPodsLoading,
    pods,
    filteredPods,
    setLogPod,
    deletePodMutation,
    PodStatusBadge,
    StatusDot,
}: PodsTabProps) {
    return (
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
    );
}
