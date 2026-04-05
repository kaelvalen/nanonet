import { CheckCircle2, Copy, Plus, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { useServices } from "@/hooks/useServices";

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
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = (): boolean => {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = "Zorunlu";
		else if (name.length < 2) e.name = "En az 2 karakter";
		else if (!/^[a-zA-Z0-9_-]+$/.test(name)) e.name = "Harf, rakam, tire ve alt çizgi kullanılabilir";

		if (!host.trim()) e.host = "Zorunlu";
		else if (!/^[a-zA-Z0-9._-]+$/.test(host)) e.host = "Geçerli hostname veya IP girin";

		if (!port || port < 1 || port > 65535) e.port = "1–65535 arası";

		if (!healthEndpoint.trim()) e.healthEndpoint = "Zorunlu";
		else if (!healthEndpoint.startsWith("/")) e.healthEndpoint = "/ ile başlamalı";

		if (pollInterval < 5 || pollInterval > 300) e.pollInterval = "5–300 saniye";

		setErrors(e);
		return Object.keys(e).length === 0;
	};

	const handleCreate = () => {
		if (!validate()) return;
		createService(
			{
				name: name.trim(),
				host: host.trim(),
				port,
				health_endpoint: healthEndpoint,
				poll_interval_sec: pollInterval,
			},
			{
				onSuccess: (data: unknown) => {
					const svc = data as { id?: string };
					setCreatedServiceId(svc?.id ?? "");
					setStep("success");
				},
			},
		);
	};

	const handleClose = () => {
		setOpen(false);
		setTimeout(() => {
			setStep("form");
			setName(""); setHost(""); setPort(8080);
			setHealthEndpoint("/health"); setPollInterval(10);
			setErrors({}); setCreatedServiceId(""); setCopied(false);
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
				{trigger ?? (
					<Button
						size="sm"
						className="h-8 px-3 text-xs text-white"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						<Plus className="w-3.5 h-3.5 mr-1.5" />
						Servis Ekle
					</Button>
				)}
			</DialogTrigger>

			<DialogContent
				className="sm:max-w-md"
				style={{
					background: "var(--surface-raised)",
					border: "1px solid var(--border-default)",
					boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
				}}
			>
				{step === "form" ? (
					<>
						<DialogHeader>
							<DialogTitle style={{ color: "var(--text-primary)" }}>
								Yeni Servis
							</DialogTitle>
							<DialogDescription style={{ color: "var(--text-muted)" }}>
								İzlemek için bir mikroservis ekleyin
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-2">
							<Field
								id="svc-name"
								label="Servis Adı"
								error={errors.name}
								required
							>
								<Input
									id="svc-name"
									placeholder="payment-service"
									value={name}
									onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
									aria-invalid={!!errors.name}
									style={{ borderColor: errors.name ? "var(--status-down)" : undefined }}
								/>
							</Field>

							<Field id="svc-host" label="Host / IP" error={errors.host} required>
								<Input
									id="svc-host"
									placeholder="192.168.1.42"
									value={host}
									onChange={(e) => { setHost(e.target.value); setErrors((p) => ({ ...p, host: "" })); }}
									aria-invalid={!!errors.host}
									style={{ borderColor: errors.host ? "var(--status-down)" : undefined }}
								/>
							</Field>

							<div className="grid grid-cols-2 gap-3">
								<Field id="svc-port" label="Port" error={errors.port} required>
									<Input
										id="svc-port"
										type="number"
										placeholder="8080"
										min={1} max={65535}
										value={port}
										onChange={(e) => { setPort(parseInt(e.target.value, 10) || 0); setErrors((p) => ({ ...p, port: "" })); }}
										aria-invalid={!!errors.port}
										style={{ borderColor: errors.port ? "var(--status-down)" : undefined }}
									/>
								</Field>
								<Field id="svc-endpoint" label="Health Endpoint" error={errors.healthEndpoint} required>
									<Input
										id="svc-endpoint"
										placeholder="/health"
										value={healthEndpoint}
										onChange={(e) => { setHealthEndpoint(e.target.value); setErrors((p) => ({ ...p, healthEndpoint: "" })); }}
										aria-invalid={!!errors.healthEndpoint}
										style={{ borderColor: errors.healthEndpoint ? "var(--status-down)" : undefined }}
									/>
								</Field>
							</div>

							<Field id="svc-poll" label="Poll Interval (saniye)" error={errors.pollInterval}>
								<div className="flex items-center gap-2">
									<Input
										id="svc-poll"
										type="number"
										min={5} max={300}
										value={pollInterval}
										onChange={(e) => { setPollInterval(parseInt(e.target.value, 10) || 10); setErrors((p) => ({ ...p, pollInterval: "" })); }}
										className="w-24"
										style={{ borderColor: errors.pollInterval ? "var(--status-down)" : undefined }}
									/>
									<span className="text-xs" style={{ color: "var(--text-faint)" }}>
										5–300 saniye
									</span>
								</div>
							</Field>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={handleClose} style={{ color: "var(--text-muted)" }}>
								İptal
							</Button>
							<Button
								onClick={handleCreate}
								className="text-white"
								style={{ background: "var(--gradient-btn-primary)" }}
							>
								Oluştur
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle
								className="flex items-center gap-2"
								style={{ color: "var(--status-up-text)" }}
							>
								<CheckCircle2 className="w-5 h-5" />
								Servis Oluşturuldu
							</DialogTitle>
							<DialogDescription style={{ color: "var(--text-muted)" }}>
								Agent'ı hedef sunucuya kurmak için bu komutu çalıştırın
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3 py-2">
							{/* Agent command */}
							<div className="relative">
								<div
									className="flex items-center gap-2 px-3 py-2 mb-2 rounded-t-lg"
									style={{
										background: "var(--surface-sunken)",
										borderBottom: "1px solid var(--border-subtle)",
									}}
								>
									<Terminal className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
									<span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
										bash
									</span>
								</div>
								<pre
									className="px-4 pb-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all rounded-b-lg"
									style={{
										background: "var(--surface-sunken)",
										color: "var(--text-secondary)",
									}}
								>
									{agentCmd}
								</pre>
								<button
									type="button"
									onClick={handleCopy}
									className="absolute top-2 right-2 p-1.5 rounded-md transition-colors"
									style={{
										background: "var(--surface-raised)",
										border: "1px solid var(--border-default)",
										color: copied ? "var(--status-up)" : "var(--text-muted)",
									}}
									aria-label="Komutu kopyala"
								>
									{copied ? (
										<CheckCircle2 className="w-3.5 h-3.5" />
									) : (
										<Copy className="w-3.5 h-3.5" />
									)}
								</button>
							</div>

							{/* Warning */}
							<div
								className="px-3 py-2.5 rounded-lg"
								style={{
									background: "var(--status-warn-subtle)",
									border: "1px solid var(--status-warn-border)",
								}}
							>
								<p className="text-xs" style={{ color: "var(--status-warn-text)" }}>
									<strong>Önemli:</strong> Agent token'ınızı Ayarlar → Agent Token
									bölümünden alın ve &lt;YOUR_AGENT_TOKEN&gt; kısmını değiştirin.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button
								onClick={handleClose}
								className="text-white"
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

function Field({
	id,
	label,
	error,
	required,
	children,
}: {
	id: string;
	label: string;
	error?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<Label
				htmlFor={id}
				className="text-xs font-medium flex items-center gap-1"
				style={{ color: "var(--text-secondary)" }}
			>
				{label}
				{required && (
					<span style={{ color: "var(--status-down)" }}>*</span>
				)}
			</Label>
			{children}
			{error && (
				<p className="text-xs" style={{ color: "var(--status-down-text)" }}>
					{error}
				</p>
			)}
		</div>
	);
}
