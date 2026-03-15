import React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw, Globe } from "lucide-react";
import type { ServiceInfo } from "@/api/k8s";

export interface ServicesTabProps {
    services: ServiceInfo[];
    servicesLoading: boolean;
    refetchServices: () => void;
    ServiceTypeBadge: React.FC<{ type: string }>;
}

export function ServicesTab({
    services,
    servicesLoading,
    refetchServices,
    ServiceTypeBadge
}: ServicesTabProps) {
    return (
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
    )
}
