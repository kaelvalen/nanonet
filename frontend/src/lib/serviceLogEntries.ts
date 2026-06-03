import type { LogEntry } from "@/store/serviceLogStore";

type RuntimeMessage = Record<string, unknown> & {
	type?: string;
	service_id?: string;
	data?: Record<string, unknown>;
};

function makeId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function levelFromStatus(status: unknown): LogEntry["level"] {
	if (status === "down") return "error";
	if (status === "degraded") return "warn";
	return "info";
}

export function metricLogEntry(
	serviceId: string,
	data: Record<string, unknown>,
	source = "metric",
): LogEntry {
	const cpu = asNumber(data.cpu_percent);
	const mem = asNumber(data.memory_used_mb);
	const latency = asNumber(data.latency_ms);
	const status = asString(data.status) ?? "?";
	return {
		id: makeId(source),
		timestamp: asString(data.time) ?? new Date().toISOString(),
		level: levelFromStatus(status),
		source,
		message: `cpu=${cpu?.toFixed(1) ?? "?"}% mem=${mem?.toFixed(0) ?? "?"}MB latency=${latency?.toFixed(0) ?? "?"}ms status=${status}`,
	};
}

export function runtimeMessageToLog(
	message: RuntimeMessage,
): { serviceId: string; entry: LogEntry } | null {
	if (message.type === "metric_update" && message.service_id && message.data) {
		return {
			serviceId: message.service_id,
			entry: metricLogEntry(message.service_id, message.data),
		};
	}

	if (message.type === "alert" && message.data) {
		const serviceId = asString(message.data.service_id);
		if (!serviceId) return null;
		const severity = asString(message.data.severity) ?? "info";
		return {
			serviceId,
			entry: {
				id: makeId("alert"),
				timestamp: new Date().toISOString(),
				level:
					severity === "crit" ? "error" : severity === "warn" ? "warn" : "info",
				source: "alert",
				message: `[ALERT] ${asString(message.data.message) ?? ""}`,
			},
		};
	}

	if (message.type === "command_status" && message.service_id) {
		const status = asString(message.status) ?? "unknown";
		const output = asString(message.output);
		return {
			serviceId: message.service_id,
			entry: {
				id: makeId("command"),
				timestamp: new Date().toISOString(),
				level: status === "failed" || status === "timeout" ? "error" : "info",
				source: "command",
				message: `[CMD] ${asString(message.action) ?? "command"} -> ${status}${output ? ` - ${output}` : ""}`,
			},
		};
	}

	return null;
}
