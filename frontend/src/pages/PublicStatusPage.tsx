import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useParams } from "react-router";
import {
	type PublicStatusService,
	type PublicStatusView,
	statusPageApi,
} from "@/api/statuspage";
import {
	EmptyState as SharedEmptyState,
	SkeletonCard,
} from "@/components/ui/primitives";

export function PublicStatusPage() {
	const { slug = "" } = useParams<{ slug: string }>();
	const { data, isLoading, error } = useQuery({
		queryKey: ["public-status", slug],
		queryFn: () => statusPageApi.getPublic(slug),
		refetchInterval: 30_000,
		enabled: slug.length > 0,
	});

	if (isLoading) {
		return (
			<Shell>
				<div className="flex flex-col gap-3">
					<SkeletonCard className="h-24" />
					<SkeletonCard className="h-16" />
					<SkeletonCard className="h-16" />
					<SkeletonCard className="h-16" />
				</div>
			</Shell>
		);
	}

	if (error || !data) {
		return (
			<Shell>
				<SharedEmptyState
					icon={XCircle}
					title="Status sayfası bulunamadı"
					description={`/${slug} için yayınlanmış bir sayfa yok.`}
					tone="muted"
					size="lg"
				/>
			</Shell>
		);
	}

	return (
		<Shell>
			<Header view={data} />

			<section className="mt-10">
				<SectionTitle>Servisler</SectionTitle>
				{data.services.length === 0 ? (
					<EmptyRow text="Hiç servis yayında değil." />
				) : (
					<div className="flex flex-col gap-1.5 mt-3">
						{data.services.map((s) => (
							<ServiceRow key={s.name} svc={s} />
						))}
					</div>
				)}
			</section>

			<section className="mt-10">
				<SectionTitle>Son 14 gün — olaylar</SectionTitle>
				{data.incidents.length === 0 ? (
					<EmptyRow text="Bu dönemde kayıtlı bir olay yok." />
				) : (
					<div className="flex flex-col gap-1.5 mt-3">
						{data.incidents.map((i) => (
							<IncidentRow key={`${i.title}-${i.started_at}`} incident={i} />
						))}
					</div>
				)}
			</section>

			<footer
				className="mt-12 pt-6 text-center text-[11px] font-mono tnum"
				style={{
					color: "var(--text-faint)",
					borderTop: "1px solid var(--border-subtle)",
				}}
			>
				NanoNet · {new Date(data.generated_at).toLocaleString("tr-TR")}
			</footer>
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="min-h-screen px-4 sm:px-6 py-8 sm:py-12"
			style={{ background: "var(--surface-canvas)" }}
		>
			<div className="max-w-3xl mx-auto">{children}</div>
		</div>
	);
}

function Header({ view }: { view: PublicStatusView }) {
	const tone = overallTone(view.overall);
	return (
		<header className="text-center">
			<p
				className="text-[10px] font-medium uppercase tracking-[0.18em] mb-3"
				style={{ color: "var(--text-faint)" }}
			>
				NanoNet · status
			</p>
			<h1
				className="text-[28px] font-semibold tracking-tight leading-tight"
				style={{ color: "var(--text-primary)" }}
			>
				{view.title}
			</h1>
			{view.description && (
				<p
					className="mt-3 text-[14px] leading-relaxed max-w-xl mx-auto"
					style={{ color: "var(--text-tertiary)" }}
				>
					{view.description}
				</p>
			)}
			<div
				className="mt-6 inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] text-[13px] font-semibold"
				style={{
					color: tone.color,
					background: tone.bg,
					border: `1px solid ${tone.border}`,
				}}
			>
				{tone.icon}
				{view.overall === "operational"
					? "Tüm sistemler çalışıyor"
					: view.overall === "degraded"
						? "Performans düşüşü var"
						: "Servis kesintisi var"}
			</div>
		</header>
	);
}

function ServiceRow({ svc }: { svc: PublicStatusService }) {
	const tone = statusTone(svc.status);
	return (
		<div
			className="relative flex items-center justify-between gap-3 pl-4 pr-4 py-3 rounded-[6px]"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: tone.dot }}
			/>
			<div className="flex items-center gap-3 min-w-0 pl-2">
				<div className="min-w-0">
					<p
						className="text-[14px] font-semibold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{svc.name}
					</p>
					<p
						className="text-[11px] font-mono mt-0.5 tnum"
						style={{ color: "var(--text-tertiary)" }}
					>
						{tone.label}
						{svc.latency_ms != null && (
							<>
								{" · "}
								{svc.latency_ms.toFixed(0)}ms
							</>
						)}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-5 text-[11px] font-mono tnum">
				<UptimeChip label="24s" value={svc.uptime_24h} />
				<UptimeChip label="30g" value={svc.uptime_30d} />
			</div>
		</div>
	);
}

function UptimeChip({ label, value }: { label: string; value: number }) {
	const color =
		value >= 99
			? "var(--status-up-text)"
			: value >= 95
				? "var(--status-degraded-text)"
				: "var(--status-down-text)";
	return (
		<div className="text-right">
			<p
				className="text-[10px] uppercase tracking-wider"
				style={{ color: "var(--text-faint)" }}
			>
				{label}
			</p>
			<p style={{ color }}>{value.toFixed(2)}%</p>
		</div>
	);
}

function IncidentRow({
	incident,
}: {
	incident: PublicStatusView["incidents"][number];
}) {
	const isCrit = incident.severity === "crit";
	const accent = isCrit ? "var(--status-down)" : "var(--status-degraded)";
	const bg = isCrit
		? "var(--status-down-subtle)"
		: "var(--status-degraded-subtle)";
	const fg = isCrit ? "var(--status-down-text)" : "var(--status-degraded-text)";
	return (
		<div
			className="relative flex items-center justify-between gap-3 pl-4 pr-4 py-2.5 rounded-[6px]"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-r-full"
				style={{ background: accent }}
			/>
			<div className="flex items-center gap-2.5 min-w-0 pl-2">
				<AlertTriangle
					className="w-3.5 h-3.5 shrink-0"
					style={{ color: accent }}
				/>
				<div className="min-w-0">
					<p
						className="text-[13px] font-semibold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{incident.title}
					</p>
					<p
						className="text-[11px] font-mono mt-0.5 tnum"
						style={{ color: "var(--text-tertiary)" }}
					>
						{new Date(incident.started_at).toLocaleString("tr-TR")}
						{incident.resolved ? " · çözüldü" : " · sürüyor"}
					</p>
				</div>
			</div>
			<span
				className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
				style={{ color: fg, background: bg }}
			>
				{incident.severity}
			</span>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h2
			className="text-[11px] font-medium uppercase tracking-wider"
			style={{ color: "var(--text-faint)" }}
		>
			{children}
		</h2>
	);
}

function EmptyRow({ text }: { text: string }) {
	return (
		<div
			className="mt-3 px-4 py-6 rounded-[6px] text-center text-[12px]"
			style={{
				background: "var(--surface-base)",
				border: "1px dashed var(--border-subtle)",
				color: "var(--text-tertiary)",
			}}
		>
			{text}
		</div>
	);
}

function overallTone(overall: PublicStatusView["overall"]) {
	if (overall === "down") {
		return {
			color: "var(--status-down-text)",
			bg: "var(--status-down-subtle)",
			border: "var(--status-down-border)",
			icon: <XCircle className="w-3.5 h-3.5" />,
		};
	}
	if (overall === "degraded") {
		return {
			color: "var(--status-degraded-text)",
			bg: "var(--status-degraded-subtle)",
			border: "var(--status-degraded-border)",
			icon: <Activity className="w-3.5 h-3.5" />,
		};
	}
	return {
		color: "var(--status-up-text)",
		bg: "var(--status-up-subtle)",
		border: "var(--status-up-border)",
		icon: <CheckCircle2 className="w-3.5 h-3.5" />,
	};
}

function statusTone(status: PublicStatusService["status"]) {
	switch (status) {
		case "down":
			return { dot: "var(--status-down)", label: "Kesinti" };
		case "degraded":
			return { dot: "var(--status-degraded)", label: "Performans düşüşü" };
		case "up":
			return { dot: "var(--status-up)", label: "Çalışıyor" };
		default:
			return { dot: "var(--border-strong)", label: "Bilinmiyor" };
	}
}
