import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Loader2, RotateCcw, Save } from "lucide-react";
import { metricsApi, type AlertRules } from "@/api/metrics";
import { toast } from "sonner";

interface AlertRulesTabProps {
  serviceId: string;
}

const DEFAULT_RULES: Omit<AlertRules, "service_id" | "is_default"> = {
  cpu_threshold: 80,
  memory_threshold_mb: 2048,
  latency_threshold_ms: 1000,
  error_rate_threshold: 5,
};

const FIELDS: {
  key: keyof Omit<AlertRules, "service_id" | "is_default">;
  label: string;
  unit: string;
  min: number;
  max: number;
  description: string;
  color: string;
}[] = [
  {
    key: "cpu_threshold",
    label: "CPU Eşiği",
    unit: "%",
    min: 1,
    max: 100,
    description: "Bu değeri aşan CPU kullanımında alert tetiklenir",
    color: "var(--color-teal)",
  },
  {
    key: "memory_threshold_mb",
    label: "Bellek Eşiği",
    unit: "MB",
    min: 1,
    max: 999999,
    description: "Bu değeri aşan bellek kullanımında alert tetiklenir",
    color: "var(--color-blue)",
  },
  {
    key: "latency_threshold_ms",
    label: "Gecikme Eşiği",
    unit: "ms",
    min: 1,
    max: 999999,
    description: "Bu değeri aşan yanıt süresinde alert tetiklenir",
    color: "var(--color-lavender)",
  },
  {
    key: "error_rate_threshold",
    label: "Hata Oranı Eşiği",
    unit: "%",
    min: 0,
    max: 100,
    description: "Bu değeri aşan hata oranında alert tetiklenir",
    color: "var(--status-down)",
  },
];

export function AlertRulesTab({ serviceId }: AlertRulesTabProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Omit<AlertRules, "service_id" | "is_default"> | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["alertRules", serviceId],
    queryFn: () => metricsApi.getAlertRules(serviceId),
    enabled: !!serviceId,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Omit<AlertRules, "service_id" | "is_default">) =>
      metricsApi.updateAlertRules(serviceId, data),
    onSuccess: () => {
      toast.success("Alert eşikleri güncellendi");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["alertRules", serviceId] });
    },
    onError: () => toast.error("Alert eşikleri güncellenemedi"),
  });

  const current = form ?? (rules
    ? {
        cpu_threshold: rules.cpu_threshold,
        memory_threshold_mb: rules.memory_threshold_mb,
        latency_threshold_ms: rules.latency_threshold_ms,
        error_rate_threshold: rules.error_rate_threshold,
      }
    : DEFAULT_RULES);

  const isDirty = form !== null;

  if (isLoading) {
    return (
      <Card
        className="p-5 rounded animate-pulse"
        style={{ background: "var(--surface-card)", border: "2px solid var(--border-default)" }}
      >
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded"
              style={{ background: "var(--surface-sunken)" }}
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-5 rounded"
      style={{
        background: "var(--surface-card)",
        border: "2px solid var(--border-default)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Alert Eşikleri
          </h3>
          {rules?.is_default && (
            <span
              className="text-[10px] px-2 py-0.5 rounded"
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-faint)",
              }}
            >
              varsayılan
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setForm(null)}
              className="rounded text-xs h-7"
              style={{ color: "var(--text-muted)", borderColor: "var(--border-default)" }}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> İptal
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(current)}
            disabled={!isDirty || saveMutation.isPending}
            className="rounded text-xs h-7 text-white"
            style={
              isDirty
                ? { background: "var(--gradient-btn-primary)", boxShadow: "var(--btn-shadow)" }
                : { opacity: 0.5 }
            }
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Kaydet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, unit, min, max, description, color }) => {
          const value = current[key];
          const pct = Math.min((value / max) * 100, 100);

          return (
            <div
              key={key}
              className="p-4 rounded space-y-2"
              style={{
                background: "var(--surface-sunken)",
                border: "2px solid var(--border-default)",
              }}
            >
              <div className="flex items-center justify-between">
                <label
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color }}
                >
                  {label}
                </label>
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {value} {unit}
                </span>
              </div>

              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--border-track)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>

              <Input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    setForm({ ...current, [key]: v });
                  }
                }}
                className="rounded text-xs h-8"
                style={{
                  background: "var(--input-bg)",
                  borderColor: isDirty && form?.[key] !== undefined ? color : "var(--input-border)",
                  color: "var(--text-secondary)",
                }}
              />

              <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
