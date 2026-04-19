import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, History, Loader2, XCircle } from "lucide-react";
import { servicesApi } from "@/api/services";

const ACTION_TONE: Record<
	string,
	{ color: string; bg: string; border: string }
> = {
	restart: {
		color: "var(--color-teal)",
		bg: "var(--color-teal-subtle)",
		border: "var(--color-teal-border)",
	},
	stop: {
		color: "var(--status-warn-text)",
		bg: "var(--status-warn-subtle)",
		border: "var(--status-warn-border)",
	},
	start: {
		color: "var(--status-up-text)",
		bg: "var(--status-up-subtle)",
		border: "var(--status-up-border)",
	},
	exec: {
		color: "var(--color-blue)",
		bg: "var(--color-blue-subtle)",
		border: "var(--color-blue-border)",
	},
	scale: {
		color: "var(--color-lavender)",
		bg: "var(--color-lavender-subtle)",
		border: "var(--color-lavender-border)",
	},
	ping: {
		color: "var(--text-muted)",
		bg: "var(--surface-sunken)",
		border: "var(--border-default)",
	},
};

function StatusIcon({ status }: { status: string }) {
	if (status === "success") {
		return (
			<CheckCircle2
				className="w-3.5 h-3.5 shrink-0"
				style={{ color: "var(--status-up)" }}
			/>
		);
	}
	if (status === "failed" || status === "timeout") {
		return (
			<XCircle
				className="w-3.5 h-3.5 shrink-0"
				style={{ color: "var(--status-down)" }}
			/>
		);
	}
	return (
		<Loader2
			className="w-3.5 h-3.5 shrink-0 animate-spin"
			style={{ color: "var(--status-warn)" }}
		/>
	);
}

export function CommandHistoryTab({ serviceId }: { serviceId: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ["commandHistory", serviceId],
		queryFn: () => servicesApi.getCommandHistory(serviceId, 30, 1),
		enabled: !!serviceId,
		refetchInterval: 15000,
	});

	const logs = data?.commands ?? [];

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-12 rounded-lg animate-pulse"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					/>
				))}
			</div>
		);
	}

	if (logs.length === 0) {
		return (
			<div
				className="flex flex-col items-center justify-center p-12 rounded-lg text-center"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				<span
					className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-default)",
					}}
				>
					<History className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
				</span>
				<p
					className="text-sm font-semibold mb-1"
					style={{ color: "var(--text-primary)" }}
				>
					Henüz komut geçmişi yok
				</p>
				<p
					className="text-xs leading-relaxed max-w-sm"
					style={{ color: "var(--text-muted)" }}
				>
					Bu servis üzerinde çalıştırılan tüm agent komutları ve sistem
					eylemleri burada listelenecek.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between px-1">
				<p
					className="text-[10px] uppercase tracking-[0.2em] font-bold"
					style={{ color: "var(--text-faint)" }}
				>
					Son {logs.length} Komut
				</p>
				<p
					className="text-[10px] font-mono tabular-nums"
					style={{ color: "var(--text-faint)" }}
				>
					● 15s yenileme
				</p>
			</div>

			{logs.map((log) => {
				const tone = ACTION_TONE[log.action] ?? {
					color: "var(--text-muted)",
					bg: "var(--surface-sunken)",
					border: "var(--border-default)",
				};
				return (
					<div
						key={log.id}
						className="rounded-lg overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div className="flex items-center gap-3 px-3 py-2.5">
							<StatusIcon status={log.status} />
							<span
								className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
								style={{
									color: tone.color,
									background: tone.bg,
									border: `1px solid ${tone.border}`,
								}}
							>
								{log.action}
							</span>
							<code
								className="text-[11px] font-mono flex-1 truncate"
								style={{ color: "var(--text-secondary)" }}
								title={log.command_id}
							>
								{log.command_id.slice(0, 16)}…
							</code>
							{log.duration_ms != null && (
								<span
									className="text-[10px] font-mono tabular-nums shrink-0"
									style={{ color: "var(--text-faint)" }}
								>
									{log.duration_ms}ms
								</span>
							)}
							<span
								className="text-[10px] font-mono tabular-nums shrink-0"
								style={{ color: "var(--text-faint)" }}
							>
								{new Date(log.queued_at).toLocaleString("tr-TR", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								})}
							</span>
						</div>
						{log.output && (
							<pre
								className="m-2 mt-0 p-2.5 rounded text-[11px] font-mono whitespace-pre-wrap break-all line-clamp-3"
								style={{
									color: "var(--text-secondary)",
									background: "var(--surface-sunken)",
									border: "1px solid var(--border-subtle)",
								}}
							>
								{log.output}
							</pre>
						)}
					</div>
				);
			})}
		</div>
	);
}
