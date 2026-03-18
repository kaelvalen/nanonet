import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, History, Loader2, XCircle } from "lucide-react";
import type React from "react";
import { servicesApi } from "@/api/services";
import { Card } from "@/components/ui/card";

export function CommandHistoryTab({ serviceId }: { serviceId: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ["commandHistory", serviceId],
		queryFn: () => servicesApi.getCommandHistory(serviceId, 30, 1),
		enabled: !!serviceId,
		refetchInterval: 15000,
	});

	const logs = data?.commands ?? [];

	const statusIcon = (status: string) => {
		if (status === "success")
			return (
				<CheckCircle2
					className="w-3.5 h-3.5"
					style={{ color: "var(--status-up)" }}
				/>
			);
		if (status === "failed" || status === "timeout")
			return (
				<XCircle
					className="w-3.5 h-3.5"
					style={{ color: "var(--status-down)" }}
				/>
			);
		return (
			<Loader2
				className="w-3.5 h-3.5 animate-spin"
				style={{ color: "var(--status-warn)" }}
			/>
		);
	};

	const actionColorStyle: Record<string, React.CSSProperties> = {
		restart: {
			color: "var(--color-teal)",
			background: "var(--color-teal-subtle)",
		},
		stop: {
			color: "var(--status-warn-text)",
			background: "var(--status-warn-subtle)",
		},
		start: {
			color: "var(--status-up-text)",
			background: "var(--status-up-subtle)",
		},
		exec: {
			color: "var(--color-blue)",
			background: "var(--color-blue-subtle)",
		},
		scale: {
			color: "var(--color-lavender)",
			background: "var(--color-lavender-subtle)",
		},
		ping: { color: "var(--text-muted)", background: "var(--surface-sunken)" },
	};

	if (isLoading)
		return (
			<Card
				className="p-6 rounded animate-pulse"
				style={{
					background: "var(--surface-card)",
					border: "2px solid var(--border-default)",
				}}
			>
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-10 rounded"
							style={{ background: "var(--color-blue-subtle)" }}
						/>
					))}
				</div>
			</Card>
		);

	if (logs.length === 0)
		return (
			<Card
				className="p-12 rounded text-center"
				style={{
					background: "var(--surface-card)",
					border: "2px solid var(--border-default)",
					boxShadow: "var(--card-shadow)",
				}}
			>
				<History
					className="w-10 h-10 mx-auto mb-3"
					style={{ color: "var(--text-faint)" }}
				/>
				<p className="text-sm" style={{ color: "var(--text-muted)" }}>
					Henüz komut geçmişi yok
				</p>
			</Card>
		);

	return (
		<div className="space-y-2">
			{logs.map((log) => (
				<Card
					key={log.id}
					className="p-3 rounded"
					style={{
						background: "var(--surface-card)",
						border: "2px solid var(--border-default)",
						boxShadow: "var(--card-shadow)",
					}}
				>
					<div className="flex items-center gap-3">
						{statusIcon(log.status)}
						<span
							className="text-[10px] font-semibold px-2 py-0.5 rounded font-mono"
							style={
								actionColorStyle[log.action] ?? {
									color: "var(--text-muted)",
									background: "var(--surface-sunken)",
								}
							}
						>
							{log.action}
						</span>
						<span
							className="text-xs font-mono flex-1 truncate"
							style={{ color: "var(--text-secondary)" }}
						>
							{log.command_id.slice(0, 12)}...
						</span>
						{log.duration_ms != null && (
							<span
								className="text-[10px]"
								style={{ color: "var(--text-faint)" }}
							>
								{log.duration_ms}ms
							</span>
						)}
						<span
							className="text-[10px]"
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
							className="mt-2 ml-6 text-[10px] font-mono rounded p-2 whitespace-pre-wrap break-all line-clamp-3"
							style={{
								color: "var(--text-muted)",
								background: "var(--surface-sunken)",
								border: "2px solid var(--border-default)",
							}}
						>
							{log.output}
						</pre>
					)}
				</Card>
			))}
			<p
				className="text-[10px] px-1 text-right"
				style={{ color: "var(--text-faint)" }}
			>
				Son {logs.length} komut · 15s yenileme
			</p>
		</div>
	);
}
