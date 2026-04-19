import {
	Activity,
	AlertTriangle,
	ArrowRight,
	BarChart3,
	Bell,
	Box,
	Brain,
	CheckCircle2,
	Cloud,
	Cpu,
	FileText,
	Flame,
	GitBranch,
	Globe,
	Hash,
	Key,
	Languages,
	Lock,
	MessageSquare,
	Network,
	Plug,
	Shield,
	Target,
	Terminal,
	TrendingUp,
	Webhook,
	Workflow,
	Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";

/* ─────────────────────────────────────────────────────────────────────────────
 * Self-contained dark palette. The landing page deliberately does NOT opt
 * into the app theme — the brand impression stays consistent regardless of
 * the user's OS theme or a remembered preference. The numbers below mirror
 * the dark-mode tokens in theme.css (so the marketing surface and the app
 * speak the same visual language) without coupling at runtime.
 *
 * Quiet Swiss rules applied here:
 *   • One accent color (CYAN). No purple, amber, rose decorations.
 *   • Status colors (RED / LIME) used ONLY when something is actually red
 *     or green semantically (a critical alert, a healthy probe). Never as
 *     decoration.
 *   • Sharp corners (6px on cards, 4px on chips, full-pill only for
 *     the few interactive controls in nav/CTA).
 *   • Hairline borders, generous negative space, tabular figures, mono
 *     for technical accents. No gradient text, no glow shadows, no
 *     blurred aurora blobs.
 * ───────────────────────────────────────────────────────────────────────── */

const INK = "#0a0a0a";
const INK_DEEP = "#070707";
const INK_RAISED = "#141414";
const INK_HAIR = "rgba(255, 255, 255, 0.06)";
const INK_LINE = "rgba(255, 255, 255, 0.10)";

const TXT = "#fafaf9";
const TXT_MUTED = "rgba(250, 250, 249, 0.70)";
const TXT_DIM = "rgba(250, 250, 249, 0.46)";
const TXT_FAINT = "rgba(250, 250, 249, 0.30)";

const BRAND = "#22d3ee";
const BRAND_SUBTLE = "rgba(34, 211, 238, 0.10)";
const BRAND_LINE = "rgba(34, 211, 238, 0.30)";
const STATUS_UP = "#a3e635";
const STATUS_DOWN = "#f87171";
const STATUS_WARN = "#fbbf24";

/* ─────────────────────────────────────────────────────────────────────────────
 * Background — a static, hairline grid that sets a "drafting board" mood.
 * No drifting blobs, no animation. The grid is the texture; the silence
 * around it is the emphasis. */

function GridBackdrop() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0"
			style={{
				backgroundImage:
					"linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
				backgroundSize: "64px 64px",
				maskImage:
					"radial-gradient(ellipse at 50% 0%, rgba(0,0,0,1), transparent 70%)",
				WebkitMaskImage:
					"radial-gradient(ellipse at 50% 0%, rgba(0,0,0,1), transparent 70%)",
			}}
		/>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Nav */

function Nav({ authed }: { authed: boolean }) {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const links: { label: string; id: string }[] = [
		{ label: "Özellikler", id: "features" },
		{ label: "Güvenilirlik", id: "reliability" },
		{ label: "AI", id: "ai" },
		{ label: "Olay & Durum", id: "incidents" },
		{ label: "Geliştiriciler", id: "devs" },
	];

	const scrollTo = (id: string) =>
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

	return (
		<header
			className="fixed top-0 inset-x-0 z-50 transition-colors duration-200"
			style={{
				background: scrolled ? "rgba(10, 10, 10, 0.82)" : "transparent",
				backdropFilter: scrolled ? "blur(12px) saturate(140%)" : undefined,
				WebkitBackdropFilter: scrolled
					? "blur(12px) saturate(140%)"
					: undefined,
				borderBottom: scrolled
					? `1px solid ${INK_HAIR}`
					: "1px solid transparent",
			}}
		>
			<div className="max-w-[1200px] mx-auto h-14 flex items-center justify-between px-6">
				<Link
					to="/"
					className="flex items-center gap-2.5"
					style={{ color: TXT }}
				>
					<Logo className="w-5 h-5" />
					<span
						className="text-[13px] font-semibold tracking-tight"
						style={{ color: TXT }}
					>
						NanoNet
					</span>
				</Link>

				<nav className="hidden md:flex items-center gap-1">
					{links.map((l) => (
						<button
							key={l.id}
							type="button"
							onClick={() => scrollTo(l.id)}
							className="h-8 px-3 text-[12px] font-medium rounded-[4px] transition-colors"
							style={{ color: TXT_MUTED }}
							onMouseEnter={(e) => {
								e.currentTarget.style.color = TXT;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color = TXT_MUTED;
							}}
						>
							{l.label}
						</button>
					))}
				</nav>

				<div className="flex items-center gap-2">
					{authed ? (
						<Link
							to="/app"
							className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[4px] text-[12px] font-medium transition-colors"
							style={{
								background: BRAND,
								color: INK,
							}}
						>
							Uygulamaya git
							<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
						</Link>
					) : (
						<>
							<Link
								to="/login"
								className="hidden sm:inline-flex h-8 px-3 items-center text-[12px] font-medium rounded-[4px] transition-colors"
								style={{ color: TXT_MUTED }}
							>
								Giriş
							</Link>
							<Link
								to="/register"
								className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[4px] text-[12px] font-semibold transition-colors"
								style={{
									background: BRAND,
									color: INK,
								}}
							>
								Başla
								<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
							</Link>
						</>
					)}
				</div>
			</div>
		</header>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Eyebrow + section heading — left-aligned, generous, no decorative pills.
 * The eyebrow is just text + a leading hairline; the title is large and
 * monochrome. Highlight (optional) is just the title in TXT_DIM, not a
 * gradient. */

function SectionEyebrow({ children }: { children: string }) {
	return (
		<div className="flex items-center gap-3 mb-6">
			<span
				aria-hidden
				className="block h-px w-8"
				style={{ background: BRAND }}
			/>
			<span
				className="text-[11px] font-mono uppercase tracking-[0.18em]"
				style={{ color: BRAND }}
			>
				{children}
			</span>
		</div>
	);
}

function SectionHeading({
	eyebrow,
	title,
	highlight,
	description,
	align = "left",
}: {
	eyebrow: string;
	title: string;
	highlight?: string;
	description?: string;
	align?: "left" | "center";
}) {
	return (
		<div
			className={`max-w-2xl mb-16 ${align === "center" ? "mx-auto text-center" : ""}`}
		>
			{align === "left" ? (
				<SectionEyebrow>{eyebrow}</SectionEyebrow>
			) : (
				<div className="flex justify-center mb-6">
					<span
						className="text-[11px] font-mono uppercase tracking-[0.18em]"
						style={{ color: BRAND }}
					>
						{eyebrow}
					</span>
				</div>
			)}
			<h2
				className="text-[34px] sm:text-[44px] font-semibold tracking-[-0.02em] leading-[1.05]"
				style={{ color: TXT }}
			>
				{title}
				{highlight && (
					<>
						{" "}
						<span style={{ color: TXT_DIM }}>{highlight}</span>
					</>
				)}
			</h2>
			{description && (
				<p
					className="mt-5 text-[15px] leading-relaxed"
					style={{ color: TXT_MUTED }}
				>
					{description}
				</p>
			)}
		</div>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hero — typography-first. Big left-aligned headline, single-color "live"
 * status line in mono, two CTAs with a strict hierarchy (one filled brand
 * pill, one ghost), then the product surface. No gradient text. */

function Hero({ authed, liveCount }: { authed: boolean; liveCount: number }) {
	const reduce = useReducedMotion();

	return (
		<section
			className="relative pt-32 sm:pt-36 pb-24 overflow-hidden"
			style={{ background: INK }}
		>
			<GridBackdrop />

			<div className="relative max-w-[1200px] mx-auto px-6">
				<motion.div
					initial={reduce ? false : { opacity: 0, y: -4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className="inline-flex items-center gap-2 mb-8"
				>
					<span
						aria-hidden
						className="relative flex w-2 h-2 items-center justify-center"
					>
						<span
							className="absolute inset-0 rounded-full"
							style={{
								background: STATUS_UP,
								opacity: 0.35,
								animation: reduce
									? undefined
									: "nn-pulse 2.4s ease-in-out infinite",
							}}
						/>
						<span
							className="relative w-1.5 h-1.5 rounded-full"
							style={{ background: STATUS_UP }}
						/>
					</span>
					<span
						className="text-[11px] font-mono uppercase tracking-[0.16em]"
						style={{ color: TXT_DIM }}
					>
						{authed && liveCount > 0
							? `${liveCount} servis · canlı`
							: "Self-hosted · açık kaynak"}
					</span>
				</motion.div>

				<motion.h1
					initial={reduce ? false : { opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="max-w-4xl text-[44px] sm:text-[64px] lg:text-[80px] font-semibold tracking-[-0.035em] leading-[0.98]"
					style={{ color: TXT }}
				>
					Altyapınızın
					<br />
					<span style={{ color: TXT_DIM }}>sinir sistemi.</span>
				</motion.h1>

				<motion.p
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="mt-7 max-w-xl text-[16px] sm:text-[17px] leading-relaxed"
					style={{ color: TXT_MUTED }}
				>
					Mikroservislerinizden gelen her sinyali gerçek zamanlı yakalar,
					anomalileri AI ile yorumlar, çözümü size yazılı olarak sunar.
					Verileriniz hiç sunucularınızdan çıkmaz.
				</motion.p>

				<motion.div
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="mt-10 flex items-center gap-3 flex-wrap"
				>
					<Link
						to={authed ? "/app" : "/register"}
						className="group inline-flex items-center gap-2 h-11 px-5 rounded-[6px] text-[13px] font-semibold transition-colors"
						style={{
							background: BRAND,
							color: INK,
						}}
					>
						{authed ? "Uygulamaya git" : "Ücretsiz başla"}
						<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
					</Link>
					<button
						type="button"
						onClick={() =>
							document
								.getElementById("how")
								?.scrollIntoView({ behavior: "smooth" })
						}
						className="inline-flex items-center gap-2 h-11 px-5 rounded-[6px] text-[13px] font-medium transition-colors"
						style={{
							color: TXT,
							border: `1px solid ${INK_LINE}`,
						}}
					>
						Nasıl çalışır
					</button>
				</motion.div>

				<div
					aria-hidden
					className="mt-6 flex items-center gap-4 text-[11px] font-mono"
					style={{ color: TXT_FAINT }}
				>
					<span className="inline-flex items-center gap-1.5">
						<CheckCircle2 className="w-3 h-3" /> Kart gerekmiyor
					</span>
					<span>·</span>
					<span>30 sn'de kurulum</span>
					<span>·</span>
					<span>MIT lisanslı</span>
				</div>

				<motion.div
					initial={reduce ? false : { opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, delay: 0.3 }}
					className="mt-20"
				>
					<ProductMock />
				</motion.div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Product mock — a calm, accurate sketch of the dashboard. Sharp corners
 * (6px), hairline borders, no glows. Status colors used semantically. */

function ProductMock() {
	return (
		<div
			className="relative mx-auto max-w-[1080px] rounded-[8px] overflow-hidden"
			style={{
				background: INK_RAISED,
				border: `1px solid ${INK_LINE}`,
			}}
		>
			<div
				className="flex items-center gap-3 px-4 h-10"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<div
					className="flex-1 h-6 rounded-[4px] flex items-center px-2.5 gap-2"
					style={{
						background: "rgba(255,255,255,0.025)",
						border: `1px solid ${INK_HAIR}`,
					}}
				>
					<span
						className="w-1.5 h-1.5 rounded-full"
						style={{ background: STATUS_UP }}
					/>
					<span
						className="text-[10.5px] font-mono tracking-wide"
						style={{ color: TXT_DIM }}
					>
						app.nanonet.dev / dashboard
					</span>
				</div>
				<span
					className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.16em]"
					style={{ color: TXT_FAINT }}
				>
					Önizleme
				</span>
			</div>

			<div className="grid grid-cols-12 min-h-[440px]">
				<aside
					className="col-span-2 hidden md:flex flex-col gap-0.5 py-3 px-2"
					style={{ borderRight: `1px solid ${INK_HAIR}` }}
				>
					{[
						{ label: "Genel", active: true },
						{ label: "Servisler" },
						{ label: "Uyarılar" },
						{ label: "AI" },
						{ label: "Loglar" },
						{ label: "Ayarlar" },
					].map((nav) => (
						<div
							key={nav.label}
							className="h-8 px-3 rounded-[4px] flex items-center text-[11.5px] font-medium relative"
							style={{
								color: nav.active ? TXT : TXT_DIM,
								background: nav.active
									? "rgba(255,255,255,0.04)"
									: "transparent",
							}}
						>
							{nav.active && (
								<span
									aria-hidden
									className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
									style={{ background: BRAND }}
								/>
							)}
							{nav.label}
						</div>
					))}
				</aside>

				<div className="col-span-12 md:col-span-10 p-5 space-y-4">
					<div className="grid grid-cols-3 gap-3">
						<MockTile label="Servisler" value="28" sub="↑ 2 bu hafta" />
						<MockTile
							label="Latency p95"
							value="42"
							unit="ms"
							sub="−12 % · 24 sa"
						/>
						<MockTile
							label="Aktif uyarı"
							value="2"
							sub="1 kritik · 1 uyarı"
							tone="warn"
						/>
					</div>

					<div
						className="rounded-[6px] p-4"
						style={{
							background: "rgba(255,255,255,0.02)",
							border: `1px solid ${INK_HAIR}`,
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-baseline gap-2">
								<span
									className="text-[12px] font-semibold"
									style={{ color: TXT }}
								>
									Latency p95
								</span>
								<span
									className="text-[10px] font-mono uppercase tracking-[0.16em]"
									style={{ color: TXT_FAINT }}
								>
									24 saat
								</span>
							</div>
							<div
								className="inline-flex items-center gap-1.5 h-5 px-2 rounded-[4px] text-[10px] font-mono uppercase tracking-[0.14em]"
								style={{
									color: BRAND,
									background: BRAND_SUBTLE,
								}}
							>
								<span
									className="w-1 h-1 rounded-full"
									style={{ background: BRAND }}
								/>
								canlı
							</div>
						</div>
						<MockSparkGraph />
					</div>

					<div className="grid grid-cols-3 gap-3">
						{[
							{ name: "api-gateway", status: "up", latency: 12 },
							{ name: "auth-service", status: "up", latency: 8 },
							{ name: "metrics-engine", status: "warn", latency: 340 },
						].map((svc) => (
							<div
								key={svc.name}
								className="relative rounded-[6px] px-3 py-2.5 flex items-center gap-2"
								style={{
									background: "rgba(255,255,255,0.02)",
									border: `1px solid ${INK_HAIR}`,
								}}
							>
								<span
									aria-hidden
									className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
									style={{
										background: svc.status === "up" ? STATUS_UP : STATUS_WARN,
									}}
								/>
								<span
									className="text-[11.5px] font-mono flex-1 truncate pl-1.5"
									style={{ color: TXT }}
								>
									{svc.name}
								</span>
								<span
									className="text-[10.5px] font-mono tnum tabular-nums"
									style={{ color: TXT_DIM }}
								>
									{svc.latency} ms
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function MockTile({
	label,
	value,
	unit,
	sub,
	tone,
}: {
	label: string;
	value: string;
	unit?: string;
	sub: string;
	tone?: "warn";
}) {
	return (
		<div
			className="rounded-[6px] px-4 py-3.5"
			style={{
				background: "rgba(255,255,255,0.02)",
				border: `1px solid ${INK_HAIR}`,
			}}
		>
			<p
				className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2"
				style={{ color: TXT_FAINT }}
			>
				{label}
			</p>
			<div className="flex items-baseline gap-1">
				<p
					className="text-[26px] font-semibold tabular-nums leading-none tracking-[-0.015em]"
					style={{ color: TXT }}
				>
					{value}
				</p>
				{unit && (
					<span className="text-[12px] font-medium" style={{ color: TXT_DIM }}>
						{unit}
					</span>
				)}
			</div>
			<p
				className="mt-2.5 text-[10.5px] font-mono tabular-nums"
				style={{ color: tone === "warn" ? STATUS_WARN : TXT_DIM }}
			>
				{sub}
			</p>
		</div>
	);
}

function MockSparkGraph() {
	const values = [24, 28, 26, 32, 30, 42, 38, 46, 42, 38, 36, 44];
	const max = Math.max(...values);
	const min = Math.min(...values);
	const range = max - min || 1;
	const pts = values
		.map(
			(v, i) =>
				`${(i / (values.length - 1)) * 240},${
					60 - ((v - min) / range) * 50 - 5
				}`,
		)
		.join(" ");
	return (
		<svg
			viewBox="0 0 240 60"
			className="w-full h-20"
			preserveAspectRatio="none"
			role="img"
			aria-label="Latency time series — mock preview"
		>
			<defs>
				<linearGradient id="mock-area" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={BRAND} stopOpacity="0.18" />
					<stop offset="100%" stopColor={BRAND} stopOpacity="0" />
				</linearGradient>
			</defs>
			<polygon fill="url(#mock-area)" points={`0,60 ${pts} 240,60`} />
			<polyline
				fill="none"
				stroke={BRAND}
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={pts}
			/>
		</svg>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Stats strip — pure typography on a hairline-bounded row. */

function StatsStrip() {
	const stats = [
		{ icon: Cpu, label: "Agent overhead", value: "<1", unit: "%" },
		{ icon: Shield, label: "Aktarım", value: "TLS", unit: "+ mTLS" },
		{ icon: Activity, label: "Poll", value: "5", unit: "s" },
		{ icon: Zap, label: "Alert SLA", value: "<10", unit: "s" },
	];
	return (
		<section className="relative" style={{ background: INK_DEEP }}>
			<div
				className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4"
				style={{ borderTop: `1px solid ${INK_HAIR}` }}
			>
				{stats.map((s, i) => (
					<div
						key={s.label}
						className="px-6 py-7 flex items-center gap-3.5"
						style={{
							borderRight:
								i < stats.length - 1 ? `1px solid ${INK_HAIR}` : undefined,
							borderBottom: i < 2 ? `1px solid ${INK_HAIR}` : undefined,
						}}
					>
						<s.icon className="w-4 h-4" style={{ color: BRAND }} />
						<div className="min-w-0">
							<p
								className="text-[10px] font-mono uppercase tracking-[0.16em]"
								style={{ color: TXT_FAINT }}
							>
								{s.label}
							</p>
							<div className="flex items-baseline gap-1 mt-1">
								<p
									className="text-[20px] font-semibold tabular-nums tracking-tight leading-none"
									style={{ color: TXT }}
								>
									{s.value}
								</p>
								{s.unit && (
									<span
										className="text-[11px] font-medium"
										style={{ color: TXT_DIM }}
									>
										{s.unit}
									</span>
								)}
							</div>
						</div>
					</div>
				))}
			</div>
			<div aria-hidden className="border-t" style={{ borderColor: INK_HAIR }} />
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Features — a 3-column grid of cards. All icons monochrome (cyan brand),
 * all cards identical apart from copy. The eye reads the LIST, not the
 * decorations. */

const FEATURES: {
	icon: typeof Activity;
	title: string;
	desc: string;
}[] = [
	{
		icon: Activity,
		title: "Gerçek zamanlı sağlık",
		desc: "Her servisin CPU, bellek, latency ve hata oranı saniyeler içinde paneline akar.",
	},
	{
		icon: Brain,
		title: "AI kök-neden analizi",
		desc: "Uyarı tetiklendiğinde olası nedeni, etkilenen bileşenleri ve çözümü tek tıkla al.",
	},
	{
		icon: GitBranch,
		title: "Bağımlılık haritası",
		desc: "Servisler arası ilişkileri görselleştir, nokta arızanın domino etkisini önceden gör.",
	},
	{
		icon: Cloud,
		title: "Kubernetes",
		desc: "Pod metrikleri, deployment durumu ve event stream aynı panelde — kubectl'e veda.",
	},
	{
		icon: Target,
		title: "SLO & hata bütçesi",
		desc: "Availability, latency ve hata oranı hedefleri tanımla; bütçe yanma hızını canlı izle.",
	},
	{
		icon: Plug,
		title: "Synthetic probe'lar",
		desc: "Sunucudan yürütülen HTTP / TCP sağlık denetimleri ve uyumluluk kanıtı.",
	},
	{
		icon: Workflow,
		title: "Otomasyon runbook'ları",
		desc: "Alert tetiklendiğinde restart, exec, scale veya webhook — cooldown ve rate limit dahil.",
	},
	{
		icon: AlertTriangle,
		title: "Olay yönetimi",
		desc: "Incident timeline, etkilenen bileşenler, postmortem notları ve süreç metrikleri.",
	},
	{
		icon: Globe,
		title: "Public status page",
		desc: "Müşterilerinize özel marka ile sunulan, slug bazlı, real-time uptime sayfaları.",
	},
	{
		icon: Bell,
		title: "Akıllı uyarılar",
		desc: "Flapping kontrolü, snooze, deduplication. Slack, Teams, Discord, e-posta ve webhook.",
	},
	{
		icon: Terminal,
		title: "Yapılandırılmış loglar",
		desc: "Tüm servislerden log toplama, severity filtresi, tam metin arama, AI özet.",
	},
	{
		icon: Shield,
		title: "Güvenlik & denetim",
		desc: "Auth olayları, port taramaları, anormal trafik ve denetim kayıtları tek panelde.",
	},
];

function Features() {
	return (
		<section id="features" className="py-28 px-6" style={{ background: INK }}>
			<div className="max-w-[1200px] mx-auto">
				<SectionHeading
					eyebrow="Yetkinlikler"
					title="Tek platform,"
					highlight="on iki kritik yetenek."
					description="İzlemeden hata bütçesine, otomasyondan public status sayfasına kadar bir SRE'nin günlük araç çantasındaki her şey."
				/>

				<div
					className="grid md:grid-cols-2 lg:grid-cols-3"
					style={{
						borderTop: `1px solid ${INK_HAIR}`,
						borderLeft: `1px solid ${INK_HAIR}`,
					}}
				>
					{FEATURES.map((f) => (
						<article
							key={f.title}
							className="relative p-7 transition-colors"
							style={{
								borderRight: `1px solid ${INK_HAIR}`,
								borderBottom: `1px solid ${INK_HAIR}`,
							}}
						>
							<f.icon className="w-4 h-4 mb-5" style={{ color: BRAND }} />
							<h3
								className="text-[15px] font-semibold mb-2 tracking-tight"
								style={{ color: TXT }}
							>
								{f.title}
							</h3>
							<p
								className="text-[13px] leading-relaxed"
								style={{ color: TXT_MUTED }}
							>
								{f.desc}
							</p>
						</article>
					))}
				</div>

				{/* Capability chip strip — quick scan of "the rest" without
				    spending another card-grid section on each. Lists the
				    things we DO ship that aren't worth a full card but should
				    be visible so the page doesn't feel under-spec'd. */}
				<div className="mt-8 flex flex-wrap gap-1.5">
					{[
						{ icon: BarChart3, label: "Servis karşılaştırma" },
						{ icon: TrendingUp, label: "Forecast & anomali" },
						{ icon: Network, label: "Yük dağılımı görünümü" },
						{ icon: Flame, label: "Burn rate uyarıları" },
						{ icon: FileText, label: "Audit log" },
						{ icon: Key, label: "API token yönetimi" },
						{ icon: MessageSquare, label: "Slack / Teams" },
						{ icon: Webhook, label: "Webhook & PagerDuty" },
						{ icon: Languages, label: "TR / EN" },
						{ icon: Lock, label: "RBAC & SSO" },
						{ icon: Hash, label: "Tag & filtre" },
						{ icon: Cpu, label: "Otomatik servis keşfi" },
					].map((c) => (
						<span
							key={c.label}
							className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-[11.5px] font-medium"
							style={{
								background: "rgba(255,255,255,0.025)",
								border: `1px solid ${INK_HAIR}`,
								color: TXT_MUTED,
							}}
						>
							<c.icon className="w-3 h-3" style={{ color: TXT_DIM }} />
							{c.label}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reliability section — the SLO + Probes + Runbooks story. This is the
 * page's heaviest "we do more than monitoring" claim, so it gets its own
 * section with a faithful mock of the SLO card the user actually sees in
 * /app/slo. Three feature columns sit under the mock for breadth. */

function ReliabilitySection() {
	return (
		<section
			id="reliability"
			className="relative py-28 px-6"
			style={{ background: INK }}
		>
			<div
				aria-hidden
				className="absolute inset-x-0 top-0 h-px"
				style={{ background: INK_HAIR }}
			/>
			<div className="max-w-[1200px] mx-auto">
				<SectionHeading
					eyebrow="Güvenilirlik"
					title="Sadece izlemiyoruz —"
					highlight="hedefliyor, ölçüyor, müdahale ediyoruz."
					description="SLO + hata bütçesi + synthetic probe + otomasyon runbook'ları — tek üründe Google SRE pratiği."
				/>

				<div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
					<div className="order-2 lg:order-1 space-y-10">
						<ReliabilityRow
							icon={Target}
							title="SLO & hata bütçesi"
							desc="Availability, latency veya hata oranı için yüzde hedefi tanımla, pencere seç (7 / 30 / 90 g). Bütçe tüketimi anlık olarak yanma hızı çarpanıyla beraber gösterilir."
							meta="3 SLI tipi · burn rate · forecast"
						/>
						<ReliabilityRow
							icon={Plug}
							title="HTTP / TCP probe'ları"
							desc="Sunucudan yürütülen synthetic kontroller; status, body içeriği ve TCP açıklığı doğrulanır. Sonuçlar SLO'larla aynı zaman serisine düşer."
							meta="60 sn'lik default · son hata mesajı · uptime sicili"
						/>
						<ReliabilityRow
							icon={Workflow}
							title="Otomasyon runbook'ları"
							desc="Alert tetiklendiğinde restart, stop, scale, exec veya webhook çalıştır. Cooldown ve saatlik üst sınır ile flapping korumalı."
							meta="6 aksiyon · severity filtresi · denetim kaydı"
						/>
					</div>
					<div className="order-1 lg:order-2 lg:sticky lg:top-24">
						<SLOMockCard />
					</div>
				</div>
			</div>
		</section>
	);
}

function ReliabilityRow({
	icon: Icon,
	title,
	desc,
	meta,
}: {
	icon: typeof Target;
	title: string;
	desc: string;
	meta: string;
}) {
	return (
		<div className="flex gap-5">
			<div
				className="shrink-0 w-9 h-9 rounded-[6px] flex items-center justify-center"
				style={{
					background: BRAND_SUBTLE,
					border: `1px solid ${BRAND_LINE}`,
				}}
			>
				<Icon className="w-4 h-4" style={{ color: BRAND }} />
			</div>
			<div className="min-w-0">
				<h3
					className="text-[16px] font-semibold tracking-tight"
					style={{ color: TXT }}
				>
					{title}
				</h3>
				<p
					className="mt-1.5 text-[13.5px] leading-relaxed"
					style={{ color: TXT_MUTED }}
				>
					{desc}
				</p>
				<p
					className="mt-2.5 text-[10.5px] font-mono uppercase tracking-[0.16em]"
					style={{ color: TXT_FAINT }}
				>
					{meta}
				</p>
			</div>
		</div>
	);
}

function SLOMockCard() {
	return (
		<div
			className="relative rounded-[8px] overflow-hidden"
			style={{
				background: INK_RAISED,
				border: `1px solid ${INK_LINE}`,
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r-full"
				style={{ background: STATUS_UP }}
			/>
			<div
				className="px-5 py-4 flex items-start gap-3"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<div
					className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
					style={{ background: "rgba(163, 230, 53, 0.10)" }}
				>
					<CheckCircle2 className="w-4 h-4" style={{ color: STATUS_UP }} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<p
							className="text-[14px] font-semibold tracking-tight"
							style={{ color: TXT }}
						>
							api availability 30 g
						</p>
						<span
							className="text-[10px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-[4px]"
							style={{ color: BRAND, background: BRAND_SUBTLE }}
						>
							Availability
						</span>
					</div>
					<p className="mt-1 text-[12px]" style={{ color: TXT_DIM }}>
						payments-api · hedef{" "}
						<span
							className="tabular-nums font-semibold"
							style={{ color: TXT }}
						>
							99.9 %
						</span>{" "}
						· 30 g pencere
					</p>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2 p-3">
				<MiniMetric label="SLI" value="99.94" unit="%" icon={Target} />
				<MiniMetric label="Bütçe" value="42" unit="%" icon={Activity} />
				<MiniMetric label="Yanma" value="0.6" unit="×" icon={Flame} />
			</div>

			<div className="px-3 pb-4">
				<MockBurndown />
			</div>
		</div>
	);
}

function MiniMetric({
	label,
	value,
	unit,
	icon: Icon,
}: {
	label: string;
	value: string;
	unit: string;
	icon: typeof Target;
}) {
	return (
		<div
			className="rounded-[6px] px-3 py-2.5 flex flex-col gap-1.5"
			style={{
				background: "rgba(255,255,255,0.025)",
				border: `1px solid ${INK_HAIR}`,
			}}
		>
			<div
				className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em]"
				style={{ color: TXT_FAINT }}
			>
				<Icon className="w-3 h-3" style={{ color: TXT_FAINT }} />
				{label}
			</div>
			<p
				className="flex items-baseline gap-0.5 leading-none"
				style={{ color: TXT }}
			>
				<span className="text-[18px] font-semibold tabular-nums tracking-tight">
					{value}
				</span>
				<span
					className="text-[11px] font-medium"
					style={{ color: TXT_FAINT }}
				>
					{unit}
				</span>
			</p>
		</div>
	);
}

function MockBurndown() {
	const values = [100, 96, 91, 87, 80, 76, 70, 66, 60, 56, 50, 47, 44, 42];
	const pts = values
		.map(
			(v, i) =>
				`${(i / (values.length - 1)) * 240},${60 - (v / 100) * 50 - 5}`,
		)
		.join(" ");
	return (
		<div
			className="rounded-[6px] p-3"
			style={{
				background: "rgba(255,255,255,0.02)",
				border: `1px solid ${INK_HAIR}`,
			}}
		>
			<div
				className="text-[10px] font-mono uppercase tracking-[0.14em] mb-1"
				style={{ color: TXT_FAINT }}
			>
				Bütçe yanma · 30 g
			</div>
			<svg
				viewBox="0 0 240 60"
				className="w-full h-16"
				preserveAspectRatio="none"
				role="img"
				aria-label="Burn-down — mock"
			>
				<defs>
					<linearGradient id="bd-grad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={BRAND} stopOpacity="0.18" />
						<stop offset="100%" stopColor={BRAND} stopOpacity="0" />
					</linearGradient>
				</defs>
				<polygon fill="url(#bd-grad)" points={`0,60 ${pts} 240,60`} />
				<polyline
					fill="none"
					stroke={BRAND}
					strokeWidth="1.25"
					points={pts}
				/>
			</svg>
		</div>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Incident & Status section — proves the platform handles the WHOLE
 * incident lifecycle. Mock incident timeline on the left, public status
 * page sketch on the right. */

function IncidentStatusSection() {
	return (
		<section
			id="incidents"
			className="relative py-28 px-6"
			style={{ background: INK_DEEP }}
		>
			<div className="max-w-[1200px] mx-auto">
				<SectionHeading
					eyebrow="Olay & Durum"
					title="Olaydan iletişime,"
					highlight="aynı pencerede."
					description="Incident timeline ile ekibinize, public status page ile müşterinize aynı doğruluğu, aynı anda."
				/>

				<div className="grid lg:grid-cols-2 gap-6">
					<IncidentTimelineMock />
					<StatusPageMock />
				</div>
			</div>
		</section>
	);
}

function IncidentTimelineMock() {
	const events: { time: string; title: string; tone?: "down" | "warn" }[] = [
		{ time: "12:44", title: "p95 latency 1.2 s'ye yükseldi", tone: "down" },
		{ time: "12:45", title: "AI: payments_by_user index eksik" },
		{ time: "12:47", title: "Runbook: payments-api restart denendi" },
		{ time: "12:51", title: "Ekibe Slack üzerinden bildirildi" },
		{ time: "13:02", title: "İndeks oluşturuldu, latency normalleşti" },
	];
	return (
		<div
			className="rounded-[8px] overflow-hidden"
			style={{
				background: INK_RAISED,
				border: `1px solid ${INK_LINE}`,
			}}
		>
			<div
				className="px-5 h-11 flex items-center gap-2"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<AlertTriangle
					className="w-3.5 h-3.5"
					style={{ color: STATUS_DOWN }}
				/>
				<span
					className="text-[12px] font-semibold"
					style={{ color: TXT }}
				>
					INC-104 · Payments degraded
				</span>
				<span
					className="ml-auto text-[10px] font-mono uppercase tracking-[0.14em]"
					style={{ color: TXT_FAINT }}
				>
					18 dk · Çözüldü
				</span>
			</div>
			<div className="px-5 py-5">
				<ol className="relative space-y-4">
					<span
						aria-hidden
						className="absolute left-[3px] top-2 bottom-2 w-px"
						style={{ background: INK_LINE }}
					/>
					{events.map((e) => {
						const dot =
							e.tone === "down"
								? STATUS_DOWN
								: e.tone === "warn"
									? STATUS_WARN
									: BRAND;
						return (
							<li
								key={e.time}
								className="relative pl-6 flex items-baseline gap-3"
							>
								<span
									aria-hidden
									className="absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full"
									style={{ background: dot }}
								/>
								<span
									className="text-[10.5px] font-mono w-10 shrink-0 tabular-nums"
									style={{ color: TXT_FAINT }}
								>
									{e.time}
								</span>
								<span
									className="text-[13px]"
									style={{ color: TXT_MUTED }}
								>
									{e.title}
								</span>
							</li>
						);
					})}
				</ol>
			</div>
			<div
				className="px-5 py-3 grid grid-cols-3 gap-4 text-[10.5px] font-mono uppercase tracking-[0.14em]"
				style={{
					borderTop: `1px solid ${INK_HAIR}`,
					color: TXT_FAINT,
				}}
			>
				<div>
					MTTA <span style={{ color: TXT }}>2 dk</span>
				</div>
				<div>
					MTTR <span style={{ color: TXT }}>18 dk</span>
				</div>
				<div>
					Etkilenen <span style={{ color: TXT }}>1 servis</span>
				</div>
			</div>
		</div>
	);
}

function StatusPageMock() {
	const services: { name: string; status: "up" | "warn" }[] = [
		{ name: "API Gateway", status: "up" },
		{ name: "Payments", status: "warn" },
		{ name: "Auth", status: "up" },
		{ name: "Webhook delivery", status: "up" },
	];
	const days = Array.from({ length: 60 }, (_, i) => {
		const r = (i * 9301 + 49297) % 100;
		return r > 96 ? "down" : r > 92 ? "warn" : "up";
	});
	return (
		<div
			className="rounded-[8px] overflow-hidden"
			style={{
				background: INK_RAISED,
				border: `1px solid ${INK_LINE}`,
			}}
		>
			<div
				className="px-5 h-11 flex items-center gap-2"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<Globe className="w-3.5 h-3.5" style={{ color: BRAND }} />
				<span
					className="text-[12px] font-semibold"
					style={{ color: TXT }}
				>
					status.acme.dev
				</span>
				<span
					className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em]"
					style={{ color: STATUS_UP }}
				>
					<span
						className="w-1.5 h-1.5 rounded-full"
						style={{ background: STATUS_UP }}
					/>
					Operational
				</span>
			</div>
			<div className="px-5 py-5 space-y-4">
				{services.map((s) => (
					<div key={s.name}>
						<div className="flex items-center justify-between mb-1.5">
							<span
								className="text-[13px] font-medium"
								style={{ color: TXT }}
							>
								{s.name}
							</span>
							<span
								className="text-[10.5px] font-mono uppercase tracking-[0.14em]"
								style={{
									color: s.status === "up" ? STATUS_UP : STATUS_WARN,
								}}
							>
								{s.status === "up" ? "Operational" : "Degraded"}
							</span>
						</div>
						<div className="flex gap-[2px] h-3">
							{days.map((d, i) => (
								<span
									key={`${s.name}-${i}`}
									aria-hidden
									className="flex-1 rounded-[1px]"
									style={{
										background:
											d === "up"
												? "rgba(163, 230, 53, 0.55)"
												: d === "warn"
													? "rgba(251, 191, 36, 0.65)"
													: "rgba(248, 113, 113, 0.65)",
									}}
								/>
							))}
						</div>
					</div>
				))}
			</div>
			<div
				className="px-5 py-3 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.14em]"
				style={{
					borderTop: `1px solid ${INK_HAIR}`,
					color: TXT_FAINT,
				}}
			>
				<span>
					Uptime <span style={{ color: TXT }}>99.97 %</span>
				</span>
				<span>Son 60 gün</span>
			</div>
		</div>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * IntegrationsStrip — quiet horizontal band that names the channels and
 * platforms NanoNet talks to. Avoids brand-logo soup; the typography is
 * the proof. Sits between HowItWorks and DevSection so the page acquires
 * a "we plug into your stack" beat without another large mock. */

function IntegrationsStrip() {
	const groups: { label: string; items: string[] }[] = [
		{
			label: "Bildirim",
			items: ["Slack", "Teams", "Discord", "E-posta", "Webhook", "PagerDuty"],
		},
		{
			label: "Altyapı",
			items: ["Kubernetes", "Docker", "systemd", "HTTP / TCP", "Linux", "Windows"],
		},
		{
			label: "Erişim",
			items: ["REST API", "OAuth tokens", "RBAC", "Audit log", "TR / EN"],
		},
	];
	return (
		<section
			className="py-20 px-6"
			style={{
				background: INK,
				borderTop: `1px solid ${INK_HAIR}`,
				borderBottom: `1px solid ${INK_HAIR}`,
			}}
		>
			<div className="max-w-[1200px] mx-auto">
				<div className="grid md:grid-cols-3 gap-10">
					{groups.map((g) => (
						<div key={g.label}>
							<p
								className="text-[10.5px] font-mono uppercase tracking-[0.18em] mb-4"
								style={{ color: BRAND }}
							>
								{g.label}
							</p>
							<ul className="space-y-2">
								{g.items.map((item) => (
									<li
										key={item}
										className="text-[14px] flex items-center gap-2"
										style={{ color: TXT_MUTED }}
									>
										<span
											aria-hidden
											className="inline-block w-1 h-1 rounded-full"
											style={{ background: TXT_FAINT }}
										/>
										{item}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * How it works — three steps as a horizontal storyboard. Step number is
 * the scale device, not color. */

function HowItWorks() {
	const steps = [
		{
			n: "01",
			icon: Box,
			title: "Servisi kaydedin",
			desc: "Dashboard'dan host, port ve health endpoint'ini girin. Otuz saniyede tamam.",
		},
		{
			n: "02",
			icon: Terminal,
			title: "Agent'ı kurun",
			desc: "Tek satırlık setup script'i ile sunucuya dağıtın. Binary küçük, daemon hafif.",
		},
		{
			n: "03",
			icon: Zap,
			title: "İzlemeye başlayın",
			desc: "Metrikler canlı akmaya başlar. AI uyarıların nedenini, harita bağımlılıkları gösterir.",
		},
	];

	return (
		<section
			id="how"
			className="relative py-28 px-6"
			style={{ background: INK_DEEP }}
		>
			<div className="max-w-[1200px] mx-auto">
				<SectionHeading
					eyebrow="Akış"
					title="Üç adımda canlı."
					highlight="Karmaşa yok."
				/>

				<div
					className="grid md:grid-cols-3 relative"
					style={{ borderTop: `1px solid ${INK_HAIR}` }}
				>
					{steps.map((s, i) => (
						<div
							key={s.n}
							className="p-8"
							style={{
								borderRight:
									i < steps.length - 1 ? `1px solid ${INK_HAIR}` : undefined,
							}}
						>
							<div className="flex items-baseline gap-3 mb-6">
								<span
									className="text-[11px] font-mono uppercase tracking-[0.18em]"
									style={{ color: BRAND }}
								>
									{s.n}
								</span>
								<span
									aria-hidden
									className="block flex-1 h-px"
									style={{ background: INK_HAIR }}
								/>
							</div>
							<s.icon className="w-5 h-5 mb-4" style={{ color: TXT }} />
							<h3
								className="text-[18px] font-semibold tracking-tight mb-2"
								style={{ color: TXT }}
							>
								{s.title}
							</h3>
							<p
								className="text-[13.5px] leading-relaxed"
								style={{ color: TXT_MUTED }}
							>
								{s.desc}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * AI section — a side-by-side: copy on the left, a faithful sketch of the
 * in-app AI Insight card on the right. The card uses the SAME design rules
 * as the actual app component (status accent bar, semantic colors, plain
 * code chips). */

function AISection() {
	return (
		<section
			id="ai"
			className="relative py-28 px-6"
			style={{ background: INK }}
		>
			<div className="max-w-[1200px] mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
				<div>
					<SectionEyebrow>AI kök-neden</SectionEyebrow>
					<h2
						className="text-[34px] sm:text-[44px] font-semibold tracking-[-0.02em] leading-[1.05]"
						style={{ color: TXT }}
					>
						Sadece "down" demiyoruz —{" "}
						<span style={{ color: TXT_DIM }}>ne, neden, nasıl?</span>
					</h2>
					<p
						className="mt-5 text-[15px] leading-relaxed max-w-lg"
						style={{ color: TXT_MUTED }}
					>
						Claude destekli analiz motoru; metrik, log ve alert geçmişini
						birleştirip olası kök-nedeni, etkilenen bileşenleri ve uygulanabilir
						çözümü çıkarır.
					</p>
					<ul className="mt-8 space-y-3.5">
						{[
							"Metrik anomalisi + log pattern korelasyonu",
							"Etkilenen servis ağı görselleştirmesi",
							"Deployment penceresi ile olay eşleştirme",
							"Slack / Teams'e tek mesaj olarak özet",
						].map((item) => (
							<li key={item} className="flex items-start gap-3">
								<CheckCircle2
									className="w-4 h-4 mt-0.5 shrink-0"
									style={{ color: BRAND }}
								/>
								<span className="text-[14px]" style={{ color: TXT_MUTED }}>
									{item}
								</span>
							</li>
						))}
					</ul>
				</div>

				<AIExampleCard />
			</div>
		</section>
	);
}

function AIExampleCard() {
	return (
		<div
			className="relative rounded-[8px] overflow-hidden"
			style={{
				background: INK_RAISED,
				border: `1px solid ${INK_LINE}`,
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r-full"
				style={{ background: STATUS_DOWN }}
			/>

			<div
				className="flex items-center gap-2.5 px-5 h-11"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<Brain className="w-3.5 h-3.5" style={{ color: BRAND }} />
				<span className="text-[12px] font-semibold" style={{ color: TXT }}>
					AI analizi
				</span>
				<span
					className="ml-auto text-[10px] font-mono uppercase tracking-[0.14em]"
					style={{ color: TXT_FAINT }}
				>
					2 sn önce
				</span>
			</div>

			<div
				className="px-5 py-4"
				style={{ borderBottom: `1px solid ${INK_HAIR}` }}
			>
				<div className="flex items-center gap-2 mb-2.5">
					<span
						className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-[0.14em]"
						style={{
							color: STATUS_DOWN,
							background: "rgba(248, 113, 113, 0.10)",
						}}
					>
						<span
							className="w-1 h-1 rounded-full"
							style={{ background: STATUS_DOWN }}
						/>
						Kritik
					</span>
					<span
						className="ml-auto text-[10.5px] font-mono"
						style={{ color: TXT_FAINT }}
					>
						payments-api · 12:44
					</span>
				</div>
				<p
					className="text-[14px] font-medium leading-snug tabular-nums"
					style={{ color: TXT }}
				>
					p95 latency 1.2 s'ye yükseldi · hata oranı %8
				</p>
			</div>

			<div className="px-5 py-5 space-y-5">
				<div>
					<p
						className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2"
						style={{ color: TXT_FAINT }}
					>
						Olası kök-neden
					</p>
					<p
						className="text-[13px] leading-relaxed"
						style={{ color: TXT_MUTED }}
					>
						Son deployment'ta değişen SQL sorgusu yeni bir index kullanıyor gibi
						görünüyor.{" "}
						<code
							className="text-[12px] px-1.5 py-0.5 rounded-[4px] font-mono"
							style={{
								color: BRAND,
								background: BRAND_SUBTLE,
								border: `1px solid ${BRAND_LINE}`,
							}}
						>
							payments_by_user
						</code>{" "}
						index'i RDS'te yok.
					</p>
				</div>
				<div>
					<p
						className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2"
						style={{ color: TXT_FAINT }}
					>
						Önerilen aksiyon
					</p>
					{/* The global typography stylesheet ships a default light
					    surface-sunken background for both <pre> and <code> tags.
					    The landing page never opts into the dark theme, so those
					    defaults paint a bright bar over our content. We render
					    the SQL block as a plain <div> + <span> stack with our own
					    chrome to sidestep both rules entirely — no surprises from
					    cascade priority. */}
					<div
						className="rounded-[6px] px-3.5 py-3 text-[12px] font-mono leading-[1.75] overflow-x-auto whitespace-pre"
						style={{
							background: "rgba(255, 255, 255, 0.025)",
							border: `1px solid ${INK_HAIR}`,
							color: TXT,
						}}
					>
						<span style={{ color: BRAND }}>CREATE INDEX</span>{" "}
						<span style={{ color: TXT_DIM }}>CONCURRENTLY</span>{" "}
						payments_by_user{"\n"}
						{"  "}
						<span style={{ color: TXT_DIM }}>ON</span> payments
						<span style={{ color: TXT_DIM }}>(</span>user_id
						<span style={{ color: TXT_DIM }}>);</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Developer section — terminal sketch on the right, copy + a 3-stat row
 * on the left. */

function DevSection() {
	return (
		<section
			id="devs"
			className="relative py-28 px-6"
			style={{ background: INK_DEEP }}
		>
			<div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
				<div>
					<SectionEyebrow>Geliştiriciler için</SectionEyebrow>
					<h2
						className="text-[34px] sm:text-[44px] font-semibold tracking-[-0.02em] leading-[1.05]"
						style={{ color: TXT }}
					>
						Tek script, <span style={{ color: TXT_DIM }}>sıfır sürpriz.</span>
					</h2>
					<p
						className="mt-5 text-[15px] leading-relaxed max-w-lg"
						style={{ color: TXT_MUTED }}
					>
						Tek binary agent. Docker değil, daemon değil — küçük, hafif,
						denetlenebilir. Alt yapınıza girmeden önce kaynak kodunu okuyun.
					</p>
					<div
						className="mt-8 grid grid-cols-3"
						style={{
							borderTop: `1px solid ${INK_HAIR}`,
							borderLeft: `1px solid ${INK_HAIR}`,
						}}
					>
						{[
							{ label: "Binary", value: "6", unit: "MB" },
							{ label: "RAM avg", value: "18", unit: "MB" },
							{ label: "Poll", value: "5", unit: "s" },
						].map((m) => (
							<div
								key={m.label}
								className="px-5 py-5"
								style={{
									borderRight: `1px solid ${INK_HAIR}`,
									borderBottom: `1px solid ${INK_HAIR}`,
								}}
							>
								<p
									className="text-[10px] font-mono uppercase tracking-[0.16em]"
									style={{ color: TXT_FAINT }}
								>
									{m.label}
								</p>
								<div className="flex items-baseline gap-1 mt-1.5">
									<p
										className="text-[24px] font-semibold tabular-nums tracking-[-0.015em] leading-none"
										style={{ color: TXT }}
									>
										{m.value}
									</p>
									<span
										className="text-[11px] font-medium"
										style={{ color: TXT_DIM }}
									>
										{m.unit}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>

				<div
					className="relative rounded-[8px] overflow-hidden"
					style={{
						background: "#08080a",
						border: `1px solid ${INK_LINE}`,
					}}
				>
					<div
						className="flex items-center gap-2 px-4 h-9"
						style={{ borderBottom: `1px solid ${INK_HAIR}` }}
					>
						<span
							className="text-[10px] font-mono uppercase tracking-[0.16em]"
							style={{ color: TXT_FAINT }}
						>
							~ / nanonet-agent
						</span>
					</div>
					{/* See AIExampleCard above — we use <div> + whitespace-pre
					    instead of <pre>/<code> to avoid the global typography
					    stylesheet painting a light surface-sunken background
					    over the content. */}
					<div
						className="p-5 font-mono text-[12px] leading-[1.8] overflow-x-auto whitespace-pre"
						style={{ color: TXT_MUTED, background: "transparent" }}
					>
						<span style={{ color: TXT_FAINT }}># Agent kurulumu</span>
						{"\n"}
						<span style={{ color: BRAND }}>$</span> ./agent-setup.sh{" "}
						<span style={{ color: TXT_FAINT }}>\</span>
						{"\n   "}
						<span style={{ color: TXT_DIM }}>--backend</span>{" "}
						<span style={{ color: TXT }}>https://api.nanonet.dev</span>{" "}
						<span style={{ color: TXT_FAINT }}>\</span>
						{"\n   "}
						<span style={{ color: TXT_DIM }}>--token</span>{" "}
						<span style={{ color: TXT }}>$NANONET_TOKEN</span>
						{"\n\n"}
						<span style={{ color: TXT_DIM }}>→ Servis eşleniyor…</span>
						{"\n"}
						<span style={{ color: TXT_DIM }}>
							→ Binary doğrulanıyor (6.2 MB)
						</span>
						{"\n"}
						<span style={{ color: TXT_DIM }}>→ systemd unit kuruldu</span>
						{"\n"}
						<span style={{ color: STATUS_UP }}>
							✓ nanonet-agent aktif · PID 12847
						</span>
					</div>
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CTA — quiet end-cap. No gradient text. Just a centered headline, a
 * single sentence, and the same two-button hierarchy as the hero. */

function CTA({ authed }: { authed: boolean }) {
	return (
		<section
			className="relative py-32 px-6 overflow-hidden"
			style={{ background: INK }}
		>
			<GridBackdrop />
			<div className="relative max-w-3xl mx-auto text-center">
				<h2
					className="text-[34px] sm:text-[52px] font-semibold tracking-[-0.025em] leading-[1.05]"
					style={{ color: TXT }}
				>
					Bugün kurun,
					<br />
					<span style={{ color: TXT_DIM }}>yarın huzur içinde olun.</span>
				</h2>
				<p
					className="mt-6 text-[15px] max-w-lg mx-auto leading-relaxed"
					style={{ color: TXT_MUTED }}
				>
					Self-hosted, açık kaynak. İlk servisi dakikalar içinde bağlayın —
					hiçbir şeyi bulutumuza göndermeden.
				</p>
				<div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
					<Link
						to={authed ? "/app" : "/register"}
						className="group inline-flex items-center gap-2 h-11 px-5 rounded-[6px] text-[13px] font-semibold transition-colors"
						style={{
							background: BRAND,
							color: INK,
						}}
					>
						{authed ? "Dashboard'a git" : "Ücretsiz başla"}
						<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
					</Link>
					{!authed && (
						<Link
							to="/login"
							className="inline-flex items-center gap-2 h-11 px-5 rounded-[6px] text-[13px] font-medium transition-colors"
							style={{
								color: TXT,
								border: `1px solid ${INK_LINE}`,
							}}
						>
							Giriş yap
						</Link>
					)}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Footer */

function Footer() {
	return (
		<footer
			className="py-10 px-6"
			style={{
				background: INK_DEEP,
				borderTop: `1px solid ${INK_HAIR}`,
			}}
		>
			<div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
				<div
					className="flex items-center gap-2.5"
					style={{ color: TXT_MUTED }}
				>
					<Logo className="w-4 h-4" />
					<span className="text-[12.5px] font-semibold" style={{ color: TXT }}>
						NanoNet
					</span>
					<span
						className="text-[10px] font-mono uppercase tracking-[0.16em]"
						style={{ color: TXT_FAINT }}
					>
						v2.0
					</span>
				</div>
				<div className="flex items-center gap-x-5 gap-y-2 flex-wrap justify-center">
					{[
						{ label: "Dashboard", to: "/app" },
						{ label: "Servisler", to: "/app/services" },
						{ label: "SLO", to: "/app/slo" },
						{ label: "Olaylar", to: "/app/incidents" },
						{ label: "Uyarılar", to: "/app/alerts" },
						{ label: "API tokens", to: "/app/api-tokens" },
					].map((l) => (
						<Link
							key={l.to}
							to={l.to}
							className="text-[12px] transition-colors"
							style={{ color: TXT_DIM }}
							onMouseEnter={(e) => {
								e.currentTarget.style.color = TXT;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color = TXT_DIM;
							}}
						>
							{l.label}
						</Link>
					))}
				</div>
				<p className="text-[10.5px] font-mono" style={{ color: TXT_FAINT }}>
					© 2026 NanoNet · Sinyalin gürültüye karşı zaferi
				</p>
			</div>
		</footer>
	);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Page */

export function LandingPage() {
	const authed = useAuthStore((s) => s.isAuthenticated);
	const { services } = useServices({ enabled: authed });
	const liveCount = services.filter((s) => s.status === "up").length;

	return (
		<div className="antialiased" style={{ background: INK, color: TXT }}>
			<style>{`
				@keyframes nn-pulse {
					0%, 100% { transform: scale(0.85); opacity: 0.30; }
					50%      { transform: scale(1.55); opacity: 0.55; }
				}
			`}</style>
			<Nav authed={authed} />
			<main>
				<Hero authed={authed} liveCount={liveCount} />
				<StatsStrip />
				<Features />
				<ReliabilitySection />
				<AISection />
				<IncidentStatusSection />
				<HowItWorks />
				<IntegrationsStrip />
				<DevSection />
				<CTA authed={authed} />
			</main>
			<Footer />
		</div>
	);
}
