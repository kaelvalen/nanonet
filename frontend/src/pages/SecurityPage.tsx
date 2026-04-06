import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
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
import { motion } from "motion/react";
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
import { Card } from "@/components/ui/card";

// ── Yardımcı bileşenler ─────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 80
      ? "var(--status-up)"
      : score >= 60
        ? "var(--color-yellow)"
        : "var(--status-down)";

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" className="-rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-lg font-bold tabular-nums"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: SecurityFinding["severity"] }) {
  const map = {
    critical: { label: "Kritik", bg: "var(--status-down-subtle)", color: "var(--status-down-text)", border: "var(--status-down-border)" },
    high: { label: "Yüksek", bg: "var(--color-orange-subtle)", color: "var(--color-orange-text)", border: "var(--color-orange-border)" },
    medium: { label: "Orta", bg: "var(--color-yellow-subtle)", color: "var(--color-yellow-text)", border: "var(--color-yellow-border)" },
    low: { label: "Düşük", bg: "var(--surface-sunken)", color: "var(--text-faint)", border: "var(--border-subtle)" },
  };
  const cfg = map[severity] ?? map.low;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function TLSStatus({ scan }: { scan?: SecurityScan }) {
  if (!scan) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  if (!scan.tls_enabled)
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
        <ShieldOff className="w-3.5 h-3.5" /> HTTP
      </span>
    );
  if (!scan.tls_valid)
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--status-down)" }}>
        <XCircle className="w-3.5 h-3.5" /> Geçersiz
      </span>
    );
  const days = scan.tls_days_left ?? 999;
  if (days < 7)
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--status-down)" }}>
        <AlertCircle className="w-3.5 h-3.5" /> {days}g kaldı
      </span>
    );
  if (days < 30)
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-yellow)" }}>
        <AlertTriangle className="w-3.5 h-3.5" /> {days}g kaldı
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--status-up)" }}>
      <ShieldCheck className="w-3.5 h-3.5" /> {scan.tls_version || "TLS"}
    </span>
  );
}

// ── Servis satırı ──────────────────────────────────────────────────────────

function ServiceSecurityRow({
  summary,
  onScan,
  scanning,
}: {
  summary: ServiceScanSummary;
  onScan: (id: string) => void;
  scanning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const scan = summary.latest_scan;
  const score = scan?.risk_score ?? null;
  const scoreColor =
    score === null
      ? "var(--text-faint)"
      : score >= 80
        ? "var(--status-up)"
        : score >= 60
          ? "var(--color-yellow)"
          : "var(--status-down)";
  const findings: SecurityFinding[] = scan?.findings ?? [];

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={() => scan && setExpanded((e) => !e)}
      >
        {/* Servis adı */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {summary.service_name}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
            {summary.service_host}:{summary.service_port}
          </p>
        </div>

        {/* TLS durumu */}
        <div className="w-28 hidden sm:block">
          <TLSStatus scan={scan} />
        </div>

        {/* Eksik başlık sayısı */}
        <div className="w-20 hidden md:block text-center">
          {scan ? (
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: (scan.missing_headers?.length ?? 0) > 0 ? "var(--color-yellow)" : "var(--status-up)" }}
            >
              {scan.missing_headers?.length ?? 0}
            </span>
          ) : (
            <span style={{ color: "var(--text-faint)" }}>—</span>
          )}
        </div>

        {/* Skor */}
        <div className="w-16 text-center">
          {score !== null ? (
            <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
              {Math.round(score)}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Taranmadı</span>
          )}
        </div>

        {/* Tarama butonu */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onScan(summary.service_id);
          }}
          disabled={scanning}
          title="Şimdi tara"
        >
          {scanning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ScanLine className="w-3.5 h-3.5" />
          )}
        </Button>

        {scan && findings.length > 0 && (
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform shrink-0"
            style={{
              color: "var(--text-faint)",
              transform: expanded ? "rotate(90deg)" : "none",
            }}
          />
        )}
      </div>

      {expanded && findings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-3 space-y-1.5"
          style={{ background: "var(--surface-sunken)" }}
        >
          {findings.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1">
              <SeverityBadge severity={f.severity} />
              <span style={{ color: "var(--text-secondary)" }}>{f.description}</span>
            </div>
          ))}
          {scan?.server_header && (
            <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
              Server: <code className="font-mono">{scan.server_header}</code>
            </div>
          )}
          {scan?.scanned_at && (
            <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
              <Clock className="w-3 h-3" />
              {new Date(scan.scanned_at).toLocaleString("tr-TR")}
            </div>
          )}
        </motion.div>
      )}
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

function AuditEventRow({ log }: { log: AuditLog }) {
  const action = log.Action ?? log.action ?? "";
  const ip = log.IPAddress ?? log.ip_address ?? "";
  const status = log.Status ?? log.status ?? "success";
  const createdAt = log.CreatedAt ?? log.created_at ?? "";

  const statusStyle: Record<string, { color: string; label: string }> = {
    success: { color: "var(--status-up)", label: "Başarılı" },
    failure: { color: "var(--color-yellow)", label: "Başarısız" },
    blocked: { color: "var(--status-down)", label: "Engellendi" },
  };
  const st = statusStyle[status] ?? statusStyle.success;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          {action}
        </span>
        {ip && (
          <span className="ml-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
            {ip}
          </span>
        )}
      </div>
      <span className="text-[10px] shrink-0" style={{ color: st.color }}>
        {st.label}
      </span>
      <span className="text-[10px] shrink-0 hidden sm:block" style={{ color: "var(--text-faint)" }}>
        {createdAt ? new Date(createdAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
      </span>
    </div>
  );
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────

export function SecurityPage() {
  const queryClient = useQueryClient();
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set());

  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ["security-overview"],
    queryFn: securityApi.getOverview,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-logs-security"],
    queryFn: async () => {
      const res = await apiClient.get("/audit", { params: { limit: 50 } });
      return (res.data.data?.logs ?? res.data.data ?? []) as AuditLog[];
    },
    staleTime: 30_000,
  });

  const triggerMutation = useMutation({
    mutationFn: (serviceId: string) => securityApi.triggerScan(serviceId),
    onMutate: (serviceId) => {
      setScanningIds((prev) => new Set(prev).add(serviceId));
    },
    onSettled: (_, __, serviceId) => {
      setScanningIds((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    },
    onSuccess: () => {
      toast.success("Tarama tamamlandı");
      queryClient.invalidateQueries({ queryKey: ["security-overview"] });
    },
    onError: () => toast.error("Tarama başarısız"),
  });

  // AI raporu: mevcut /ai/report endpoint'ini çağırır
  const aiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(
        "/ai/report",
        { time_range: "24h" },
        { timeout: 90_000 },
      );
      return res.data.data?.report;
    },
    onSuccess: (report) => {
      if (report?.headline) {
        toast.info(report.headline, { duration: 8000 });
      }
    },
    onError: () => toast.error("AI analizi başarısız"),
  });

  // Agrega istatistikler
  const blockedCount =
    auditData?.filter((l) => (l.Status ?? l.status) === "blocked").length ?? 0;
  const failedCount =
    auditData?.filter((l) => (l.Status ?? l.status) === "failure").length ?? 0;

  const services = overview?.services ?? [];
  const score = overview?.security_score ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-faint)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: "var(--status-down-subtle)", color: "var(--status-down-text)" }}
        >
          Güvenlik verileri yüklenemedi. Tarama başlatmak için bir servis seçin.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* ── Başlık ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--color-blue-subtle)" }}
          >
            <Shield className="w-5 h-5" style={{ color: "var(--color-blue)" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Güvenlik
            </h1>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Pasif TLS ve başlık denetimleri
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-8"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Yenile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending}
            className="h-8"
          >
            {aiMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            AI Analizi
          </Button>
        </div>
      </div>

      {/* ── Özet kartları ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Güvenlik skoru */}
        <Card
          className="p-4 col-span-2 sm:col-span-1 flex items-center gap-4"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
        >
          <ScoreRing score={score} />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Güvenlik Skoru
            </p>
            <p
              className="text-xs mt-0.5"
              style={{
                color:
                  score >= 80
                    ? "var(--status-up)"
                    : score >= 60
                      ? "var(--color-yellow)"
                      : "var(--status-down)",
              }}
            >
              {score >= 80 ? "İyi" : score >= 60 ? "Dikkat" : "Kritik"}
            </p>
          </div>
        </Card>

        {/* TLS uyarıları */}
        <Card
          className="p-4 space-y-1"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            TLS Uyarısı
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: (overview?.tls_warnings ?? 0) > 0 ? "var(--status-down)" : "var(--text-primary)" }}>
            {overview?.tls_warnings ?? 0}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
            {(overview?.tls_warnings ?? 0) > 0 ? "sertifika sorunu" : "sorunsuz"}
          </p>
        </Card>

        {/* Başlık sorunları */}
        <Card
          className="p-4 space-y-1"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Başlık Sorunu
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: (overview?.header_issues ?? 0) > 0 ? "var(--color-yellow)" : "var(--text-primary)" }}>
            {overview?.header_issues ?? 0}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
            eksik güvenlik başlığı
          </p>
        </Card>

        {/* Engellenen istek */}
        <Card
          className="p-4 space-y-1"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Engellenen
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: blockedCount > 0 ? "var(--status-down)" : "var(--text-primary)" }}>
            {blockedCount}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
            son 50 audit olayında
          </p>
        </Card>
      </div>

      {/* ── Servis güvenlik tablosu ──────────────────────────────── */}
      <Card
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", overflow: "hidden" }}
      >
        {/* Tablo başlığı */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <ShieldAlert className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Servis Güvenlik Durumu
          </span>
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--surface-sunken)", color: "var(--text-faint)" }}
          >
            {services.length} servis
          </span>
        </div>

        {/* Kolon başlıkları */}
        <div
          className="flex items-center gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex-1">Servis</div>
          <div className="w-28 hidden sm:block">TLS</div>
          <div className="w-20 hidden md:block text-center">Eksik Başlık</div>
          <div className="w-16 text-center">Skor</div>
          <div className="w-9" />
        </div>

        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Shield className="w-8 h-8" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Henüz taranmış servis yok
            </p>
          </div>
        ) : (
          services.map((s) => (
            <ServiceSecurityRow
              key={s.service_id}
              summary={s}
              onScan={(id) => triggerMutation.mutate(id)}
              scanning={scanningIds.has(s.service_id)}
            />
          ))
        )}
      </Card>

      {/* ── Son auth olayları ────────────────────────────────────── */}
      {auditData && auditData.length > 0 && (
        <Card
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", overflow: "hidden" }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <FileText className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
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
          <div>
            {auditData
              .filter((l) => {
                const action = l.Action ?? l.action ?? "";
                return action.startsWith("auth.");
              })
              .slice(0, 15)
              .map((log, i) => (
                <AuditEventRow key={log.ID ?? log.id ?? i} log={log} />
              ))}
          </div>
        </Card>
      )}

      {/* ── AI analiz sonucu gösterimi ───────────────────────────── */}
      {aiMutation.data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className="p-4 space-y-2"
            style={{
              background: "var(--color-blue-subtle)",
              border: "1px solid var(--color-blue-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--color-blue)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--color-blue-text)" }}>
                AI Güvenlik İçgörüsü
              </span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--surface-sunken)", color: "var(--text-faint)" }}
              >
                {aiMutation.data.system_score}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {aiMutation.data.headline}
            </p>
            {aiMutation.data.risk_forecast && (
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Tahmin: {aiMutation.data.risk_forecast}
              </p>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
