import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { STATUS_COLOR } from "./constants";

export function StatusIcon({
	status,
	size = "w-3.5 h-3.5",
}: {
	status: string;
	size?: string;
}) {
	const color = STATUS_COLOR[status] ?? STATUS_COLOR.unknown;
	if (status === "up")
		return <CheckCircle2 className={size} style={{ color }} />;
	if (status === "degraded")
		return <AlertTriangle className={size} style={{ color }} />;
	if (status === "down") return <XCircle className={size} style={{ color }} />;
	return <HelpCircle className={size} style={{ color }} />;
}
