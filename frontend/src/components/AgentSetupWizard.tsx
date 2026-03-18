import { useMutation } from "@tanstack/react-query";
import {
	Check,
	CheckCircle2,
	ChevronRight,
	Copy,
	Download,
	Key,
	Loader2,
	Server,
	Terminal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import apiClient from "@/api/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface AgentSetupWizardProps {
	open: boolean;
	onClose: () => void;
	serviceId?: string;
	serviceName?: string;
}

function CopyBox({ value, label }: { value: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<div
			className="rounded p-3 font-mono text-xs relative group"
			style={{
				background: "var(--surface-sunken)",
				border: "2px solid var(--border-default)",
			}}
		>
			{label && (
				<p
					className="text-[10px] mb-1 font-sans font-semibold"
					style={{ color: "var(--text-muted)" }}
				>
					{label}
				</p>
			)}
			<pre
				className="whitespace-pre-wrap break-all pr-8"
				style={{ color: "var(--text-secondary)" }}
			>
				{value}
			</pre>
			<button
				onClick={copy}
				className="absolute top-2 right-2 p-1.5 rounded transition-all"
				style={{
					background: copied
						? "var(--status-up-subtle)"
						: "var(--surface-card)",
					border: "1.5px solid var(--border-default)",
					color: copied ? "var(--status-up-text)" : "var(--text-muted)",
				}}
				title="Kopyala"
			>
				{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
			</button>
		</div>
	);
}

const STEPS = [
	{ id: 1, label: "Agent Token Al", icon: Key },
	{ id: 2, label: "Binary İndir", icon: Download },
	{ id: 3, label: "Başlat & Doğrula", icon: Terminal },
];

export function AgentSetupWizard({
	open,
	onClose,
	serviceId,
	serviceName,
}: AgentSetupWizardProps) {
	const [step, setStep] = useState(1);
	const [agentToken, setAgentToken] = useState<string | null>(null);

	const generateToken = useMutation({
		mutationFn: async () => {
			const res = await apiClient.post("/auth/agent-token", {
				service_id: serviceId,
			});
			return res.data.data?.token as string;
		},
		onSuccess: (token) => {
			setAgentToken(token);
			setStep(2);
		},
		onError: () => {
			toast.error("Token oluşturulamadı");
		},
	});

	const apiBaseUrl =
		import.meta.env.VITE_API_URL?.replace("/api/v1", "") ??
		"http://localhost:8080";
	const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080/ws";

	const linuxCmd = agentToken
		? `./nanonet-agent \\
  --ws-url ${wsUrl}/agent \\
  --token ${agentToken} \\
  --service-id ${serviceId ?? "<service-id>"} \\
  --poll-interval 10`
		: "";

	const dockerCmd = agentToken
		? `docker run -d --name nanonet-agent \\
  -e WS_URL=${wsUrl}/agent \\
  -e TOKEN=${agentToken} \\
  -e SERVICE_ID=${serviceId ?? "<service-id>"} \\
  ghcr.io/nanonet/agent:latest`
		: "";

	const handleClose = () => {
		setStep(1);
		setAgentToken(null);
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				className="max-w-lg rounded"
				style={{
					background: "var(--surface-card)",
					border: "2px solid var(--border-default)",
					boxShadow: "var(--panel-shadow)",
				}}
			>
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2 text-sm font-bold"
						style={{ color: "var(--text-primary)" }}
					>
						<Server className="w-4 h-4" style={{ color: "var(--primary)" }} />
						Agent Kurulum Rehberi
						{serviceName && (
							<span
								className="ml-1 text-xs font-normal"
								style={{ color: "var(--text-muted)" }}
							>
								— {serviceName}
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				{/* Step indicators */}
				<div className="flex items-center gap-1 mb-4">
					{STEPS.map((s, i) => {
						const done = step > s.id;
						const active = step === s.id;
						return (
							<div key={s.id} className="flex items-center gap-1 flex-1">
								<div
									className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold flex-1"
									style={{
										background: done
											? "var(--status-up-subtle)"
											: active
												? "var(--color-teal-subtle)"
												: "var(--surface-sunken)",
										border: `1.5px solid ${done ? "var(--status-up-border)" : active ? "var(--color-teal-border)" : "var(--border-subtle)"}`,
										color: done
											? "var(--status-up-text)"
											: active
												? "var(--color-teal)"
												: "var(--text-faint)",
									}}
								>
									{done ? (
										<CheckCircle2 className="w-3 h-3" />
									) : (
										<s.icon className="w-3 h-3" />
									)}
									<span className="hidden sm:inline truncate">{s.label}</span>
									<span className="sm:hidden">{s.id}</span>
								</div>
								{i < STEPS.length - 1 && (
									<ChevronRight
										className="w-3 h-3 shrink-0"
										style={{ color: "var(--text-faint)" }}
									/>
								)}
							</div>
						);
					})}
				</div>

				{/* Step 1: Token */}
				{step === 1 && (
					<div className="space-y-4">
						<p className="text-xs" style={{ color: "var(--text-muted)" }}>
							Agent'ın backend'e bağlanabilmesi için bir kimlik doğrulama
							token'ı gerekir. Bu token yalnızca bu servis için geçerlidir.
						</p>
						<div
							className="p-3 rounded text-xs"
							style={{
								background: "var(--color-lavender-subtle)",
								border: "1.5px solid var(--color-lavender-border)",
								color: "var(--text-secondary)",
							}}
						>
							<strong>Önemli:</strong> Token yalnızca bir kez gösterilir.
							Güvenli bir yere kaydedin.
						</div>
						<Button
							onClick={() => generateToken.mutate()}
							disabled={generateToken.isPending}
							className="w-full rounded"
							style={{
								background: "var(--primary)",
								color: "var(--primary-foreground)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							{generateToken.isPending ? (
								<>
									<Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{" "}
									Oluşturuluyor...
								</>
							) : (
								<>
									<Key className="w-3.5 h-3.5 mr-2" /> Agent Token Oluştur
								</>
							)}
						</Button>
					</div>
				)}

				{/* Step 2: Binary + Token */}
				{step === 2 && agentToken && (
					<div className="space-y-3">
						<p className="text-xs" style={{ color: "var(--text-muted)" }}>
							Token oluşturuldu. Binary'yi indirip aşağıdaki komutla başlatın.
						</p>
						<CopyBox
							value={agentToken}
							label="Agent Token (güvenli yere kaydedin)"
						/>

						<div className="flex gap-2">
							<a
								href={`${apiBaseUrl}/downloads/nanonet-agent-linux-amd64`}
								className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold"
								style={{
									background: "var(--surface-sunken)",
									border: "2px solid var(--border-default)",
									color: "var(--text-secondary)",
									boxShadow: "var(--btn-shadow)",
								}}
							>
								<Download className="w-3.5 h-3.5" /> Linux x64
							</a>
							<a
								href={`${apiBaseUrl}/downloads/nanonet-agent-linux-arm64`}
								className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold"
								style={{
									background: "var(--surface-sunken)",
									border: "2px solid var(--border-default)",
									color: "var(--text-secondary)",
									boxShadow: "var(--btn-shadow)",
								}}
							>
								<Download className="w-3.5 h-3.5" /> Linux ARM64
							</a>
						</div>

						<Button
							onClick={() => setStep(3)}
							className="w-full rounded"
							style={{
								background: "var(--primary)",
								color: "var(--primary-foreground)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							Devam <ChevronRight className="w-3.5 h-3.5 ml-1" />
						</Button>
					</div>
				)}

				{/* Step 3: Start command */}
				{step === 3 && agentToken && (
					<div className="space-y-3">
						<p className="text-xs" style={{ color: "var(--text-muted)" }}>
							Binary'yi çalıştırılabilir yapıp başlatın:
						</p>

						<CopyBox
							label="Linux / macOS"
							value={`chmod +x nanonet-agent\n${linuxCmd}`}
						/>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div
									className="w-full"
									style={{ borderTop: "1px solid var(--border-subtle)" }}
								/>
							</div>
							<div className="relative flex justify-center">
								<span
									className="px-2 text-[10px]"
									style={{
										background: "var(--surface-card)",
										color: "var(--text-faint)",
									}}
								>
									veya Docker ile
								</span>
							</div>
						</div>

						<CopyBox label="Docker" value={dockerCmd} />

						<div
							className="p-3 rounded text-xs"
							style={{
								background: "var(--status-up-subtle)",
								border: "1.5px solid var(--status-up-border)",
								color: "var(--status-up-text)",
							}}
						>
							Agent başarıyla bağlandığında bu servisin durumu{" "}
							<strong>UP</strong> olarak güncellenecektir.
						</div>

						<Button
							onClick={handleClose}
							className="w-full rounded"
							style={{
								background: "var(--primary)",
								color: "var(--primary-foreground)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							<CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Tamamlandı
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
