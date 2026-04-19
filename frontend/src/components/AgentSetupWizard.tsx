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
import { authApi } from "@/api/auth";
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
			className="rounded-[6px] p-3 font-mono text-[12px] relative group"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{label && (
				<p
					className="text-[10px] mb-1.5 font-sans font-medium uppercase tracking-wider"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
			)}
			<pre
				className="whitespace-pre-wrap break-all pr-8 leading-relaxed"
				style={{ color: "var(--text-secondary)" }}
			>
				{value}
			</pre>
			<button
				type="button"
				onClick={copy}
				aria-label="Kopyala"
				className="absolute top-2 right-2 p-1.5 rounded-[4px] transition-colors"
				style={{
					background: copied
						? "var(--status-up-subtle)"
						: "var(--surface-base)",
					color: copied ? "var(--status-up-text)" : "var(--text-tertiary)",
				}}
			>
				{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
			</button>
		</div>
	);
}

const STEPS = [
	{ id: 1, label: "Agent token al", icon: Key },
	{ id: 2, label: "Binary indir", icon: Download },
	{ id: 3, label: "Başlat & doğrula", icon: Terminal },
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
		mutationFn: () => authApi.createAgentToken(serviceId ?? ""),
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
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2 text-[14px] font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						<Server
							className="w-4 h-4"
							style={{ color: "var(--brand-primary)" }}
						/>
						Agent kurulum rehberi
						{serviceName && (
							<span
								className="ml-1 text-[12px] font-normal"
								style={{ color: "var(--text-tertiary)" }}
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
									className="flex items-center gap-1.5 px-2 h-7 rounded-[4px] text-[10px] font-medium uppercase tracking-wider flex-1"
									style={{
										background: done
											? "var(--status-up-subtle)"
											: active
												? "var(--brand-primary-subtle)"
												: "var(--surface-sunken)",
										color: done
											? "var(--status-up-text)"
											: active
												? "var(--brand-primary)"
												: "var(--text-faint)",
									}}
								>
									{done ? (
										<CheckCircle2 className="w-3 h-3" />
									) : (
										<s.icon className="w-3 h-3" />
									)}
									<span className="hidden sm:inline truncate">{s.label}</span>
									<span className="sm:hidden tnum">{s.id}</span>
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
						<p
							className="text-[13px] leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							Agent'ın backend'e bağlanabilmesi için bir kimlik doğrulama
							token'ı gerekir. Bu token yalnızca bu servis için geçerlidir.
						</p>
						<div
							className="relative rounded-[6px] p-3 pl-4 text-[12px] leading-relaxed"
							style={{
								background: "var(--status-degraded-subtle)",
								color: "var(--status-degraded-text)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--status-degraded)" }}
							/>
							<strong className="font-semibold">Önemli:</strong> Token yalnızca
							bir kez gösterilir. Güvenli bir yere kaydedin.
						</div>
						<Button
							onClick={() => generateToken.mutate()}
							disabled={generateToken.isPending}
							className="w-full"
						>
							{generateToken.isPending ? (
								<>
									<Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
									Oluşturuluyor…
								</>
							) : (
								<>
									<Key className="w-3.5 h-3.5 mr-2" />
									Agent token oluştur
								</>
							)}
						</Button>
					</div>
				)}

				{/* Step 2: Binary + Token */}
				{step === 2 && agentToken && (
					<div className="space-y-3">
						<p
							className="text-[13px] leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							Token oluşturuldu. Binary'yi indirip aşağıdaki komutla başlatın.
						</p>
						<CopyBox
							value={agentToken}
							label="Agent token (güvenli yere kaydedin)"
						/>

						<div className="flex gap-2">
							<Button asChild variant="outline" className="flex-1">
								<a href={`${apiBaseUrl}/downloads/nanonet-agent-linux-amd64`}>
									<Download className="w-3.5 h-3.5 mr-1.5" /> Linux x64
								</a>
							</Button>
							<Button asChild variant="outline" className="flex-1">
								<a href={`${apiBaseUrl}/downloads/nanonet-agent-linux-arm64`}>
									<Download className="w-3.5 h-3.5 mr-1.5" /> Linux ARM64
								</a>
							</Button>
						</div>

						<Button onClick={() => setStep(3)} className="w-full">
							Devam et <ChevronRight className="w-3.5 h-3.5 ml-1" />
						</Button>
					</div>
				)}

				{/* Step 3: Start command */}
				{step === 3 && agentToken && (
					<div className="space-y-3">
						<p
							className="text-[13px] leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							Binary'yi çalıştırılabilir yapıp başlatın:
						</p>

						<CopyBox
							label="Linux / macOS"
							value={`chmod +x nanonet-agent\n${linuxCmd}`}
						/>

						<div className="relative py-1">
							<div className="absolute inset-0 flex items-center">
								<div
									className="w-full"
									style={{ borderTop: "1px solid var(--border-subtle)" }}
								/>
							</div>
							<div className="relative flex justify-center">
								<span
									className="px-2 text-[10px] uppercase tracking-wider"
									style={{
										background: "var(--surface-overlay)",
										color: "var(--text-faint)",
									}}
								>
									ya da Docker ile
								</span>
							</div>
						</div>

						<CopyBox label="Docker" value={dockerCmd} />

						<div
							className="relative rounded-[6px] p-3 pl-4 text-[12px] leading-relaxed"
							style={{
								background: "var(--status-up-subtle)",
								color: "var(--status-up-text)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--status-up)" }}
							/>
							Agent başarıyla bağlandığında bu servisin durumu{" "}
							<strong className="font-semibold">AKTİF</strong> olarak
							güncellenecektir.
						</div>

						<Button onClick={handleClose} className="w-full">
							<CheckCircle2 className="w-3.5 h-3.5 mr-2" />
							Tamamlandı
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
