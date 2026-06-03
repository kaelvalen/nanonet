import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Bot,
	CheckCircle2,
	ChevronRight,
	Clock,
	Loader2,
	Server,
	Sparkles,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import { billingApi, type Plan, type PlanSummary } from "@/api/billing";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
	if (n === 0) return "—";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}

function unlimited(n: number): string {
	return n >= 999 ? "Sınırsız" : String(n);
}

// ── Usage meter bar ───────────────────────────────────────────────────────────

function UsageMeter({
	label,
	used,
	max,
	icon: Icon,
}: {
	label: string;
	used: number;
	max: number;
	icon: React.ElementType;
}) {
	const unlimited = max >= 999;
	const pct = unlimited ? 0 : Math.min(100, (used / max) * 100);
	const color =
		pct >= 90 ? "var(--status-down)" : pct >= 70 ? "var(--status-degraded)" : "var(--brand-primary)";

	return (
		<div className="flex items-center gap-3">
			<Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-1">
					<span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
						{label}
					</span>
					<span className="text-[11px] tnum" style={{ color: "var(--text-faint)" }}>
						{used} / {unlimited ? "∞" : max}
					</span>
				</div>
				<div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
					{!unlimited && (
						<div
							className="h-full rounded-full transition-all"
							style={{ width: `${pct}%`, background: color }}
						/>
					)}
					{unlimited && (
						<div className="h-full rounded-full" style={{ width: "100%", background: "var(--brand-primary)", opacity: 0.2 }} />
					)}
				</div>
			</div>
		</div>
	);
}

// ── Plan card ─────────────────────────────────────────────────────────────────

const PLAN_HIGHLIGHTS: Record<string, { label: string; icon: React.ElementType }[]> = {
	free: [
		{ label: "3 servis", icon: Server },
		{ label: "3 agent", icon: Bot },
		{ label: "7 günlük metrik", icon: Clock },
		{ label: "AI özelliği yok", icon: Sparkles },
	],
	pro: [
		{ label: "20 servis", icon: Server },
		{ label: "20 agent", icon: Bot },
		{ label: "30 günlük metrik", icon: Clock },
		{ label: "2M AI token / ay", icon: Sparkles },
		{ label: "Kubernetes", icon: Zap },
		{ label: "SLO & Runbooks", icon: CheckCircle2 },
	],
	enterprise: [
		{ label: "Sınırsız servis", icon: Server },
		{ label: "Sınırsız agent", icon: Bot },
		{ label: "90 günlük metrik", icon: Clock },
		{ label: "20M AI token / ay", icon: Sparkles },
		{ label: "Tüm özellikler", icon: Zap },
		{ label: "5 takım üyesi", icon: CheckCircle2 },
	],
};

function PlanCard({
	plan,
	isCurrent,
	onSelect,
	isLoading,
}: {
	plan: Plan;
	isCurrent: boolean;
	onSelect: () => void;
	isLoading: boolean;
}) {
	const isPro = plan.id === "pro";
	const highlights = PLAN_HIGHLIGHTS[plan.id] ?? [];

	return (
		<div
			className="rounded-[10px] p-5 flex flex-col gap-4 relative"
			style={{
				background: isPro ? "var(--brand-primary-subtle)" : "var(--surface-base)",
				border: `1px solid ${isPro ? "var(--brand-primary)" : isCurrent ? "var(--border-strong)" : "var(--border-subtle)"}`,
				boxShadow: isPro ? "0 0 0 1px var(--brand-primary)" : undefined,
			}}
		>
			{isPro && (
				<span
					className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
					style={{ background: "var(--brand-primary)", color: "var(--brand-on-primary)" }}
				>
					Popüler
				</span>
			)}

			<div>
				<div className="flex items-center justify-between mb-1">
					<h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
						{plan.name}
					</h3>
					{isCurrent && (
						<span
							className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
							style={{ background: "var(--status-up-subtle)", color: "var(--status-up-text)" }}
						>
							Aktif
						</span>
					)}
				</div>
				<div className="flex items-baseline gap-1">
					<span className="text-[28px] font-bold tnum" style={{ color: "var(--text-primary)" }}>
						${plan.price_monthly_usd.toFixed(0)}
					</span>
					<span className="text-[12px]" style={{ color: "var(--text-faint)" }}>/ay</span>
				</div>
			</div>

			<ul className="space-y-2 flex-1">
				{highlights.map(({ label, icon: Icon }) => (
					<li key={label} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
						<Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
						{label}
					</li>
				))}
			</ul>

			<Button
				onClick={onSelect}
				disabled={isCurrent || isLoading}
				variant={isPro ? "default" : "outline"}
				className="w-full gap-2"
				size="sm"
			>
				{isLoading ? (
					<Loader2 className="w-3.5 h-3.5 animate-spin" />
				) : isCurrent ? (
					<CheckCircle2 className="w-3.5 h-3.5" />
				) : (
					<ChevronRight className="w-3.5 h-3.5" />
				)}
				{isCurrent ? "Mevcut Plan" : plan.tier === 0 ? "Ücretsize Geç" : `${plan.name}'e Geç`}
			</Button>
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BillingPage() {
	const qc = useQueryClient();

	const { data: summary, isLoading: loadingSub } = useQuery<PlanSummary>({
		queryKey: ["billing-subscription"],
		queryFn: billingApi.getSubscription,
	});

	const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
		queryKey: ["billing-plans"],
		queryFn: billingApi.getPlans,
	});

	const subscribe = useMutation({
		mutationFn: (planId: string) => billingApi.subscribe(planId),
		onSuccess: (_, planId) => {
			const plan = plans.find((p) => p.id === planId);
			toast.success(`${plan?.name ?? planId} planına geçildi`);
			qc.invalidateQueries({ queryKey: ["billing-subscription"] });
		},
		onError: (err: unknown) => {
			const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
			toast.error(msg ?? "Plan değiştirilemedi");
		},
	});

	const cancel = useMutation({
		mutationFn: billingApi.cancel,
		onSuccess: () => {
			toast.success("Abonelik dönem sonunda iptal edilecek");
			qc.invalidateQueries({ queryKey: ["billing-subscription"] });
		},
		onError: () => toast.error("İptal işlemi başarısız"),
	});

	const currentPlanId = summary?.subscription.plan_id ?? "free";
	const usage = summary?.usage;
	const plan = summary?.subscription.plan;

	const isLoading = loadingSub || loadingPlans;

	return (
		<PageShell width="wide" fill={false}>
			<PageHeader eyebrow="Platform" title="Abonelik & Plan" description="Planınızı yönetin ve kullanımınızı takip edin" />

			{isLoading && (
				<div className="flex justify-center py-16">
					<Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-faint)" }} />
				</div>
			)}

			{!isLoading && summary && (
				<>
					{/* Current usage */}
					<div
						className="rounded-[10px] p-5"
						style={{ background: "var(--surface-base)", border: "1px solid var(--border-subtle)" }}
					>
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
									Mevcut Kullanım
								</h2>
								<p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
									Plan: <strong>{plan?.name}</strong>
									{summary.subscription.cancel_at_period_end && (
										<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
											style={{ background: "var(--status-degraded-subtle)", color: "var(--status-degraded-text)" }}>
											Dönem sonunda iptal
										</span>
									)}
								</p>
							</div>
							{currentPlanId === "free" && (
								<div className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-[6px]"
									style={{ background: "var(--brand-primary-subtle)", color: "var(--brand-primary)" }}>
									<AlertTriangle className="w-3 h-3" />
									Yükselt
								</div>
							)}
						</div>

						{usage && plan && (
							<div className="space-y-3">
								<UsageMeter label="Servisler"   used={usage.services_used}    max={plan.max_services}   icon={Server} />
								<UsageMeter label="Agent'lar"   used={usage.agents_used}       max={plan.max_agents}     icon={Bot} />
								<UsageMeter label="Probe'lar"   used={usage.probes_used}       max={plan.max_probes}     icon={Zap} />
								<UsageMeter label="AI Token"    used={usage.ai_tokens_used}    max={plan.ai_tokens_monthly} icon={Sparkles} />
							</div>
						)}
					</div>

					{/* Plan cards */}
					<div>
						<h2 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
							Planlar
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							{plans.map((p) => (
								<PlanCard
									key={p.id}
									plan={p}
									isCurrent={p.id === currentPlanId}
									onSelect={() => subscribe.mutate(p.id)}
									isLoading={subscribe.isPending && subscribe.variables === p.id}
								/>
							))}
						</div>
					</div>

					{/* Plan features comparison */}
					<div
						className="rounded-[10px] overflow-hidden"
						style={{ border: "1px solid var(--border-subtle)" }}
					>
						<table className="w-full text-[12px]">
							<thead>
								<tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-subtle)" }}>
									<th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-faint)" }}>Özellik</th>
									{plans.map((p) => (
										<th key={p.id} className="text-center px-4 py-2.5 font-semibold"
											style={{ color: p.id === currentPlanId ? "var(--brand-primary)" : "var(--text-secondary)" }}>
											{p.name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{[
									{ label: "Servis", key: (p: Plan) => unlimited(p.max_services) },
									{ label: "Agent", key: (p: Plan) => unlimited(p.max_agents) },
									{ label: "Probe", key: (p: Plan) => unlimited(p.max_probes) },
									{ label: "AI Token / ay", key: (p: Plan) => fmtTokens(p.ai_tokens_monthly) },
									{ label: "Metrik saklama", key: (p: Plan) => `${p.metric_retention_days} gün` },
									{ label: "Log saklama", key: (p: Plan) => `${p.log_retention_days} gün` },
									{ label: "Kubernetes", key: (p: Plan) => p.k8s_enabled ? "✓" : "—" },
									{ label: "SLO", key: (p: Plan) => p.slo_enabled ? "✓" : "—" },
									{ label: "Runbooks", key: (p: Plan) => p.runbooks_enabled ? "✓" : "—" },
									{ label: "Takım üyesi", key: (p: Plan) => unlimited(p.team_members) },
								].map(({ label, key }, i) => (
									<tr key={label}
										style={{
											borderBottom: "1px solid var(--border-subtle)",
											background: i % 2 === 0 ? "transparent" : "var(--surface-sunken)",
										}}>
										<td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{label}</td>
										{plans.map((p) => (
											<td key={p.id} className="px-4 py-2 text-center tnum"
												style={{ color: "var(--text-primary)", fontWeight: p.id === currentPlanId ? 600 : 400 }}>
												{key(p)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Cancel */}
					{currentPlanId !== "free" && !summary.subscription.cancel_at_period_end && (
						<div className="flex justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => cancel.mutate()}
								disabled={cancel.isPending}
								className="text-[12px]"
								style={{ color: "var(--text-faint)" }}
							>
								{cancel.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
								Aboneliği İptal Et
							</Button>
						</div>
					)}
				</>
			)}
		</PageShell>
	);
}
