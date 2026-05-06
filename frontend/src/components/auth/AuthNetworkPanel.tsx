import {
	BarChart3,
	Bell,
	Database,
	ScrollText,
	Server,
	Shield,
} from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * Auth ekranındaki dekoratif "live network" panel.
 *
 * Önceden `@xyflow/react` ile interaktif bir akış grafiği render ediyorduk;
 * bu pakette tek bir static görsel için ~100KB+ JS yükü ekleniyordu (auth
 * sayfası login/register dışına çıkmadığından kullanıcılar için kayıp).
 *
 * Bu sürüm aynı görsel etkiyi (animated edges + breathing dots) saf SVG ve
 * CSS animasyonu ile veriyor — DOM dinamizmi yok, JS giriş maliyeti sıfır.
 */

type NodeStatus = "up" | "warn" | "down";

interface ServiceNode {
	id: string;
	label: string;
	icon: React.ElementType;
	status: NodeStatus;
	x: number;
	y: number;
}

const STATUS_COLOR: Record<NodeStatus, string> = {
	up: "var(--status-up)",
	warn: "var(--status-degraded)",
	down: "var(--status-down)",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
	up: "healthy",
	warn: "degraded",
	down: "down",
};

const NODE_W = 140;
const NODE_H = 32;

const NODES: ServiceNode[] = [
	{ id: "gw", label: "api-gateway", icon: Server, status: "up", x: 16, y: 124 },
	{
		id: "au",
		label: "auth-service",
		icon: Shield,
		status: "up",
		x: 220,
		y: 24,
	},
	{
		id: "me",
		label: "metrics-engine",
		icon: BarChart3,
		status: "up",
		x: 220,
		y: 134,
	},
	{
		id: "lo",
		label: "log-aggregator",
		icon: ScrollText,
		status: "up",
		x: 220,
		y: 244,
	},
	{
		id: "db",
		label: "timeseries-db",
		icon: Database,
		status: "warn",
		x: 424,
		y: 79,
	},
	{
		id: "al",
		label: "alert-manager",
		icon: Bell,
		status: "down",
		x: 424,
		y: 199,
	},
];

const EDGES: { from: string; to: string }[] = [
	{ from: "gw", to: "au" },
	{ from: "gw", to: "me" },
	{ from: "gw", to: "lo" },
	{ from: "au", to: "db" },
	{ from: "me", to: "db" },
	{ from: "lo", to: "al" },
];

const VIEW_W = 580;
const VIEW_H = 320;

function nodeAnchor(id: string, side: "right" | "left") {
	const n = NODES.find((x) => x.id === id);
	if (!n) {
		return { x: 0, y: 0 };
	}
	const x = side === "right" ? n.x + NODE_W : n.x;
	return { x, y: n.y + NODE_H / 2 };
}

function bezier(from: { x: number; y: number }, to: { x: number; y: number }) {
	const midX = (from.x + to.x) / 2;
	return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

export function AuthNetworkPanel() {
	const counts = NODES.reduce<Record<NodeStatus, number>>(
		(acc, n) => {
			acc[n.status]++;
			return acc;
		},
		{ up: 0, warn: 0, down: 0 },
	);

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{ background: "var(--surface-sunken)" }}
		>
			<div
				className="shrink-0 flex items-center gap-2.5 px-8 pt-8 pb-6"
				style={{ color: "var(--text-primary)" }}
			>
				<Logo className="w-5 h-5" />
				<span
					className="font-semibold text-[14px] tracking-tight"
					style={{ color: "var(--text-primary)" }}
				>
					NanoNet
				</span>
				<div className="ml-auto flex items-center gap-1.5">
					<span
						className="w-1.5 h-1.5 rounded-full nn-orb-breathe"
						style={{ background: "var(--status-up)" }}
					/>
					<span
						className="text-[10px] font-mono tracking-wider"
						style={{ color: "var(--text-tertiary)" }}
					>
						LIVE
					</span>
				</div>
			</div>

			<div className="flex-1 min-h-0 flex items-center justify-center px-6">
				<svg
					viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
					className="w-full h-full max-h-[420px]"
					role="img"
					aria-label="NanoNet service topology preview"
					preserveAspectRatio="xMidYMid meet"
				>
					<title>NanoNet service topology preview</title>

					{EDGES.map((e) => {
						const path = bezier(
							nodeAnchor(e.from, "right"),
							nodeAnchor(e.to, "left"),
						);
						return (
							<g key={`${e.from}-${e.to}`}>
								<path
									d={path}
									fill="none"
									stroke="var(--border-default)"
									strokeWidth={1}
								/>
								<path
									d={path}
									fill="none"
									stroke="var(--brand-primary)"
									strokeOpacity={0.45}
									strokeWidth={1}
									strokeDasharray="4 10"
									strokeLinecap="round"
								>
									<animate
										attributeName="stroke-dashoffset"
										from="0"
										to="-56"
										dur="2.4s"
										repeatCount="indefinite"
									/>
								</path>
							</g>
						);
					})}

					{NODES.map((n) => {
						const Icon = n.icon;
						return (
							<g
								key={n.id}
								transform={`translate(${n.x} ${n.y})`}
								aria-label={`${n.label} ${STATUS_LABEL[n.status]}`}
							>
								<rect
									width={NODE_W}
									height={NODE_H}
									rx={6}
									ry={6}
									fill="var(--surface-base)"
									stroke="var(--border-subtle)"
									strokeWidth={1}
								/>
								<foreignObject
									x={10}
									y={6}
									width={NODE_W - 20}
									height={NODE_H - 12}
								>
									<div
										className="flex items-center gap-2 h-full"
										style={{ color: "var(--text-secondary)" }}
									>
										<Icon
											className="w-3.5 h-3.5 shrink-0"
											style={{ color: "var(--text-tertiary)" }}
											aria-hidden
										/>
										<span
											className="text-[11px] font-mono truncate flex-1"
											style={{ color: "var(--text-secondary)" }}
										>
											{n.label}
										</span>
										<span
											className="w-1.5 h-1.5 rounded-full shrink-0 nn-orb-breathe"
											style={{ backgroundColor: STATUS_COLOR[n.status] }}
											aria-hidden
										/>
									</div>
								</foreignObject>
							</g>
						);
					})}
				</svg>
			</div>

			<div
				className="shrink-0 px-8 py-5 flex items-center gap-5"
				style={{ borderTop: "1px solid var(--border-subtle)" }}
			>
				{(["up", "warn", "down"] as NodeStatus[]).map((s) => (
					<div key={s} className="flex items-center gap-2">
						<span
							className="w-1.5 h-1.5 rounded-full"
							style={{ backgroundColor: STATUS_COLOR[s] }}
						/>
						<span
							className="text-[10px] font-mono tnum"
							style={{ color: "var(--text-tertiary)" }}
						>
							{counts[s]} {STATUS_LABEL[s]}
						</span>
					</div>
				))}
				<span
					className="ml-auto text-[10px] font-mono tnum"
					style={{ color: "var(--text-faint)" }}
				>
					{NODES.length} services
				</span>
			</div>
		</div>
	);
}
