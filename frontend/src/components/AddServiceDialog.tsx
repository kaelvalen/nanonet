import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Copy, CheckCircle2 } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { toast } from "sonner";

interface AddServiceDialogProps {
    trigger?: React.ReactNode;
}

export function AddServiceDialog({ trigger }: AddServiceDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"form" | "success">("form");
    const [createdServiceId, setCreatedServiceId] = useState("");
    const [copied, setCopied] = useState(false);
    const { createService } = useServices();

    const [name, setName] = useState("");
    const [host, setHost] = useState("");
    const [port, setPort] = useState(8080);
    const [healthEndpoint, setHealthEndpoint] = useState("/health");
    const [pollInterval, setPollInterval] = useState(10);

    // Validasyon state'leri
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) newErrors.name = "Servis adı zorunludur";
        else if (name.length < 2) newErrors.name = "En az 2 karakter olmalı";
        else if (name.length > 100) newErrors.name = "En fazla 100 karakter olabilir";
        else if (!/^[a-zA-Z0-9_-]+$/.test(name)) newErrors.name = "Sadece harf, rakam, tire ve alt çizgi kullanılabilir";

        if (!host.trim()) newErrors.host = "Host/IP zorunludur";
        else if (!/^[a-zA-Z0-9._-]+$/.test(host)) newErrors.host = "Geçerli bir hostname veya IP adresi girin";

        if (!port || port < 1 || port > 65535) newErrors.port = "Port 1-65535 arasında olmalı";

        if (!healthEndpoint.trim()) newErrors.healthEndpoint = "Health endpoint zorunludur";
        else if (!healthEndpoint.startsWith("/")) newErrors.healthEndpoint = "Endpoint / ile başlamalı";

        if (pollInterval < 5 || pollInterval > 300) newErrors.pollInterval = "Poll interval 5-300 saniye arasında olmalı";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreate = () => {
        if (!validate()) return;

        createService(
            { name: name.trim(), host: host.trim(), port, health_endpoint: healthEndpoint, poll_interval_sec: pollInterval },
            {
                onSuccess: (data: unknown) => {
                    const svc = data as { id?: string };
                    setCreatedServiceId(svc?.id || "");
                    setStep("success");
                },
            }
        );
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setStep("form");
            setName("");
            setHost("");
            setPort(8080);
            setHealthEndpoint("/health");
            setPollInterval(10);
            setErrors({});
            setCreatedServiceId("");
            setCopied(false);
        }, 200);
    };

    const agentCmd = `curl -sSL https://nanonet.dev/install.sh | sh -s -- \\
  --token <YOUR_AGENT_TOKEN> \\
  --backend ws://localhost:8080 \\
  --service-id ${createdServiceId || "<SERVICE_ID>"}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(agentCmd);
        setCopied(true);
        toast.success("Kurulum komutu kopyalandı");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        size="sm"
                        className="h-7 px-3 text-xs text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                        style={{ background: "var(--gradient-btn-primary)" }}
                    >
                        <Plus className="w-3 h-3 mr-1" /> Servis Ekle
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent
                className="sm:max-w-125 rounded-2xl"
                style={{ background: "var(--surface-overlay)", border: "1px solid var(--color-teal-border)" }}
            >
                {step === "form" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle style={{ color: "var(--text-link)" }}>Yeni Servis</DialogTitle>
                            <DialogDescription style={{ color: "var(--text-muted)" }}>
                                İzlemek için yeni bir mikroservis ekleyin
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            {/* Name */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="svc-name" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    Servis Adı *
                                </Label>
                                <Input
                                    id="svc-name"
                                    placeholder="payment-service"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                                    className="rounded-xl"
                                    style={{ background: "var(--input-bg)", borderColor: errors.name ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }}
                                    aria-invalid={!!errors.name}
                                />
                                {errors.name && <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>{errors.name}</p>}
                            </div>

                            {/* Host */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="svc-host" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    Host / IP *
                                </Label>
                                <Input
                                    id="svc-host"
                                    placeholder="192.168.1.42"
                                    value={host}
                                    onChange={(e) => { setHost(e.target.value); setErrors((p) => ({ ...p, host: "" })); }}
                                    className="rounded-xl"
                                    style={{ background: "var(--input-bg)", borderColor: errors.host ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }}
                                    aria-invalid={!!errors.host}
                                />
                                {errors.host && <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>{errors.host}</p>}
                            </div>

                            {/* Port + Endpoint */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="svc-port" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                        Port *
                                    </Label>
                                    <Input
                                        id="svc-port"
                                        type="number"
                                        placeholder="8080"
                                        min={1}
                                        max={65535}
                                        value={port}
                                        onChange={(e) => { setPort(parseInt(e.target.value) || 0); setErrors((p) => ({ ...p, port: "" })); }}
                                        className="rounded-xl"
                                        style={{ background: "var(--input-bg)", borderColor: errors.port ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }}
                                        aria-invalid={!!errors.port}
                                    />
                                    {errors.port && <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>{errors.port}</p>}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="svc-endpoint" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                        Health Endpoint *
                                    </Label>
                                    <Input
                                        id="svc-endpoint"
                                        placeholder="/health"
                                        value={healthEndpoint}
                                        onChange={(e) => { setHealthEndpoint(e.target.value); setErrors((p) => ({ ...p, healthEndpoint: "" })); }}
                                        className="rounded-xl"
                                        style={{ background: "var(--input-bg)", borderColor: errors.healthEndpoint ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }}
                                        aria-invalid={!!errors.healthEndpoint}
                                    />
                                    {errors.healthEndpoint && <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>{errors.healthEndpoint}</p>}
                                </div>
                            </div>

                            {/* Poll Interval */}
                            <div className="grid gap-1.5">
                                <Label htmlFor="svc-poll" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    Poll Interval (saniye)
                                </Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        id="svc-poll"
                                        type="number"
                                        min={5}
                                        max={300}
                                        value={pollInterval}
                                        onChange={(e) => { setPollInterval(parseInt(e.target.value) || 10); setErrors((p) => ({ ...p, pollInterval: "" })); }}
                                        className="rounded-xl w-24"
                                        style={{ background: "var(--input-bg)", borderColor: errors.pollInterval ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }}
                                        aria-invalid={!!errors.pollInterval}
                                    />
                                    <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Min 5s, Maks 300s</span>
                                </div>
                                {errors.pollInterval && <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>{errors.pollInterval}</p>}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="rounded-xl"
                                style={{ borderColor: "var(--color-teal-border)", color: "var(--text-secondary)" }}
                            >
                                İptal
                            </Button>
                            <Button
                                onClick={handleCreate}
                                className="text-white rounded-xl"
                                style={{ background: "var(--gradient-btn-primary)" }}
                            >
                                Oluştur
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2" style={{ color: "var(--status-up-text)" }}>
                                <CheckCircle2 className="w-5 h-5" /> Servis Oluşturuldu
                            </DialogTitle>
                            <DialogDescription style={{ color: "var(--text-muted)" }}>
                                Agent'ı hedef sunucuya kurmak için aşağıdaki komutu çalıştırın
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Agent Install Command */}
                            <div className="relative">
                                <pre
                                    className="rounded-xl p-4 text-xs font-(--font-mono) overflow-x-auto whitespace-pre-wrap break-all"
                                    style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)", color: "var(--text-secondary)" }}
                                >
                                    {agentCmd}
                                </pre>
                                <button
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg transition-all"
                                    style={{ background: "var(--surface-raised)", border: "1px solid var(--color-teal-border)" }}
                                    aria-label="Komutu kopyala"
                                >
                                    {copied ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                                    )}
                                </button>
                            </div>

                            <div className="p-3 rounded-xl" style={{ background: "var(--status-warn-subtle)", border: "1px solid var(--status-warn-border)" }}>
                                <p className="text-[11px]" style={{ color: "var(--status-warn-text)" }}>
                                    ⚠️ <strong>Önemli:</strong> Agent token'ınızı almak için Ayarlar → Agent Token bölümüne gidin ve &lt;YOUR_AGENT_TOKEN&gt; kısmını gerçek token ile değiştirin.
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                onClick={handleClose}
                                className="text-white rounded-xl"
                                style={{ background: "var(--gradient-btn-primary)" }}
                            >
                                Tamam
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
