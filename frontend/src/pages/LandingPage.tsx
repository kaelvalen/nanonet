import {
	Activity,
	ArrowRight,
	Bell,
	Box,
	Brain,
	CheckCircle2,
	ChevronRight,
	Cloud,
	Cpu,
	GitBranch,
	Shield,
	Sparkles,
	Terminal,
	Zap,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import logo from "@/assets/logo.webp";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained dark palette. The landing page does not opt into the app's
// theme system — it stays atmospheric regardless of the user's preference so
// the brand impression is consistent.
const INK = "#05060a";
const INK_DEEP = "#020308";
const INK_ELEV = "#0a0d14";
const TEAL = "#2dd4bf";
const VIOLET = "#a78bfa";
const AMBER = "#fbbf24";
const ROSE = "#fb7185";

// ─────────────────────────────────────────────────────────────────────────────
// Aurora — atmospheric blurred gradient blobs that drift slowly. Pure CSS,
// no canvas. Sets the mood for the whole page without a video file.

function Aurora() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden"
		>
			<motion.div
				className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full blur-[120px]"
				style={{
					background: `radial-gradient(circle, ${TEAL}33 0%, transparent 70%)`,
				}}
				animate={{
					x: [0, 60, -40, 0],
					y: [0, -30, 50, 0],
				}}
				transition={{
					duration: 22,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
			<motion.div
				className="absolute -top-1/3 right-0 w-[55vw] h-[55vw] rounded-full blur-[120px]"
				style={{
					background: `radial-gradient(circle, ${VIOLET}33 0%, transparent 70%)`,
				}}
				animate={{
					x: [0, -50, 30, 0],
					y: [0, 40, -20, 0],
				}}
				transition={{
					duration: 26,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
			<motion.div
				className="absolute top-1/3 left-1/2 w-[40vw] h-[40vw] rounded-full blur-[120px]"
				style={{
					background: `radial-gradient(circle, ${AMBER}1f 0%, transparent 70%)`,
				}}
				animate={{
					x: [0, 40, -60, 0],
					y: [0, -40, 30, 0],
				}}
				transition={{
					duration: 30,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated grid that breathes — adds tactile texture under the aurora.

function GridBackdrop() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0"
			style={{
				backgroundImage:
					"linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
				backgroundSize: "56px 56px",
				maskImage:
					"radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.9), transparent 75%)",
				WebkitMaskImage:
					"radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.9), transparent 75%)",
			}}
		/>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav

function Nav({ authed }: { authed: boolean }) {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 16);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const scrollTo = (id: string) =>
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

	const links: { label: string; id: string }[] = [
		{ label: "Özellikler", id: "features" },
		{ label: "Nasıl çalışır", id: "how" },
		{ label: "AI", id: "ai" },
		{ label: "Geliştiriciler", id: "devs" },
	];

	return (
		<div
			className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
				scrolled ? "py-2" : "py-4"
			}`}
		>
			<nav
				className={`mx-auto flex items-center justify-between max-w-6xl px-3 sm:px-4 transition-all duration-500 ${
					scrolled ? "h-12" : "h-14"
				}`}
				style={{
					background: scrolled
						? "rgba(5, 6, 10, 0.65)"
						: "rgba(5, 6, 10, 0.0)",
					backdropFilter: scrolled ? "blur(18px) saturate(160%)" : undefined,
					WebkitBackdropFilter: scrolled
						? "blur(18px) saturate(160%)"
						: undefined,
					border: scrolled
						? "1px solid rgba(255,255,255,0.06)"
						: "1px solid transparent",
					borderRadius: 999,
					boxShadow: scrolled
						? "0 8px 32px -12px rgba(0,0,0,0.6)"
						: undefined,
				}}
			>
				<Link
					to="/"
					className="flex items-center gap-2.5 pl-3"
				>
					<img src={logo} alt="" aria-hidden="true" className="w-6 h-6" />
					<span className="font-semibold text-[15px] text-white tracking-tight">
						NanoNet
					</span>
				</Link>

				<div className="hidden md:flex items-center gap-1">
					{links.map((l) => (
						<button
							key={l.id}
							type="button"
							onClick={() => scrollTo(l.id)}
							className="px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors rounded-full"
						>
							{l.label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-2 pr-1">
					{authed ? (
						<Link
							to="/app"
							className="group flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full text-[13px] font-semibold transition-all hover:scale-[1.03]"
							style={{ background: "#ffffff", color: "#0f172a" }}
						>
							Uygulamaya git
							<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
						</Link>
					) : (
						<>
							<Link
								to="/login"
								className="hidden sm:flex h-9 px-4 items-center text-[13px] font-medium text-white/80 hover:text-white transition-colors rounded-full"
							>
								Giriş
							</Link>
							<Link
								to="/register"
								className="group flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full text-[13px] font-semibold transition-all hover:scale-[1.03]"
								style={{ background: "#ffffff", color: "#0f172a" }}
							>
								Başla
								<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
							</Link>
						</>
					)}
				</div>
			</nav>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero

function Hero({ authed, liveCount }: { authed: boolean; liveCount: number }) {
	const ref = useRef<HTMLElement | null>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end start"],
	});
	const previewY = useTransform(scrollYProgress, [0, 1], [0, 60]);
	const previewScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

	return (
		<section
			ref={ref}
			className="relative pt-36 sm:pt-44 pb-24 overflow-hidden"
			style={{ background: INK }}
		>
			<Aurora />
			<GridBackdrop />

			<div className="relative max-w-6xl mx-auto px-6 text-center">
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					className="inline-flex items-center gap-2.5 h-8 pl-2 pr-3.5 rounded-full mb-10"
					style={{
						background:
							"linear-gradient(135deg, rgba(45,212,191,0.12), rgba(167,139,250,0.12))",
						border: "1px solid rgba(255,255,255,0.08)",
						backdropFilter: "blur(8px)",
					}}
				>
					<span
						className="relative flex w-5 h-5 items-center justify-center"
						aria-hidden
					>
						<span
							className="absolute inset-0 rounded-full"
							style={{
								background: TEAL,
								opacity: 0.25,
								animation: "nn-orb-breathe 2.4s ease-in-out infinite",
							}}
						/>
						<span
							className="relative w-1.5 h-1.5 rounded-full"
							style={{ background: TEAL }}
						/>
					</span>
					<span className="text-[12px] font-medium text-white/85">
						{authed && liveCount > 0
							? `${liveCount} servis canlı izleniyor`
							: "Self-hosted · AI destekli kök-neden analizi"}
					</span>
				</motion.div>

				<motion.h1
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
					className="text-[44px] sm:text-6xl lg:text-[88px] font-semibold tracking-[-0.04em] text-white leading-[1.02] mb-7"
				>
					Altyapınızın
					<br />
					<span
						className="inline-block"
						style={{
							background: `linear-gradient(120deg, #ffffff 0%, ${TEAL} 45%, ${VIOLET} 100%)`,
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						sinir sistemi.
					</span>
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.15 }}
					className="text-[16px] sm:text-[18px] text-white/55 max-w-2xl mx-auto leading-relaxed mb-12"
				>
					Mikroservislerinizden gelen her sinyali gerçek zamanlı yakalar,
					anomalileri AI ile yorumlar, çözümü size yazılı olarak sunar.
					Verileriniz hiç sunucularınızdan çıkmaz.
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.25 }}
					className="flex items-center justify-center gap-3 flex-wrap mb-20"
				>
					<Link
						to={authed ? "/app" : "/register"}
						className="group relative inline-flex items-center gap-2 h-12 px-7 rounded-full text-[14px] font-semibold transition-all hover:scale-[1.03]"
						style={{
							background: "#ffffff",
							color: "#0f172a",
							boxShadow:
								"0 12px 40px -8px rgba(45,212,191,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
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
						className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-[14px] font-medium text-white/85 hover:text-white transition-colors"
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.08)",
						}}
					>
						Nasıl çalışır
						<ChevronRight className="w-4 h-4" />
					</button>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 40 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, delay: 0.35 }}
					style={{ y: previewY, scale: previewScale }}
					className="relative"
				>
					<div
						aria-hidden
						className="absolute inset-x-12 -top-10 h-32 blur-3xl opacity-50"
						style={{
							background: `radial-gradient(ellipse at center, ${TEAL}40, ${VIOLET}30, transparent 70%)`,
						}}
					/>
					<ProductMock />
				</motion.div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Product mock — full-bleed dashboard preview

function ProductMock() {
	return (
		<div
			className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden"
			style={{
				background: INK_ELEV,
				border: "1px solid rgba(255,255,255,0.08)",
				boxShadow:
					"0 40px 80px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)",
			}}
		>
			<div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.015]">
				<div className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-rose-500/30" />
					<span className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
					<span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
				</div>
				<div className="mx-2 flex-1 h-7 rounded-full bg-white/[0.03] border border-white/5 flex items-center px-3 gap-2">
					<span
						className="w-1.5 h-1.5 rounded-full"
						style={{ background: TEAL }}
					/>
					<span className="text-[11px] font-mono text-white/40 tracking-wide">
						app.nanonet.dev / dashboard
					</span>
				</div>
				<span className="text-[10px] font-mono text-white/30 hidden sm:inline">
					Canlı önizleme
				</span>
			</div>

			<div className="grid grid-cols-12 min-h-[420px]">
				<div
					className="col-span-2 hidden md:flex flex-col gap-1 p-3 border-r border-white/5"
					style={{ background: "rgba(255,255,255,0.015)" }}
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
							className="h-7 px-2.5 rounded-md flex items-center text-[11px] font-medium"
							style={{
								background: nav.active
									? "rgba(45,212,191,0.1)"
									: "transparent",
								color: nav.active ? TEAL : "rgba(255,255,255,0.5)",
							}}
						>
							{nav.label}
						</div>
					))}
				</div>

				<div className="col-span-12 md:col-span-10 p-5 space-y-4">
					<div className="grid grid-cols-3 gap-3">
						<MockTile label="Servisler" value="28" sub="↑ 2 bu hafta" accent={TEAL} />
						<MockTile label="Latency p95" value="42" unit="ms" sub="-12% · 24h" accent={VIOLET} />
						<MockTile label="Aktif uyarı" value="2" sub="1 kritik · 1 uyarı" accent={ROSE} />
					</div>

					<div
						className="rounded-xl p-4"
						style={{
							background: "rgba(255,255,255,0.025)",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div>
								<span className="text-[12px] font-semibold text-white/85">
									Latency p95
								</span>
								<span className="ml-2 text-[10px] font-mono text-white/30">
									24 saat
								</span>
							</div>
							<div
								className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
								style={{
									background: "rgba(45,212,191,0.1)",
									color: TEAL,
								}}
							>
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: TEAL }}
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
								className="rounded-xl px-3 py-2.5 flex items-center gap-2"
								style={{
									background: "rgba(255,255,255,0.025)",
									border: "1px solid rgba(255,255,255,0.05)",
								}}
							>
								<span
									className="relative flex items-center justify-center w-3 h-3"
									aria-hidden
								>
									<span
										className="absolute inset-0 rounded-full"
										style={{
											background:
												svc.status === "up" ? "#34d399" : "#fbbf24",
											opacity: 0.25,
											animation: "nn-orb-breathe 2.4s ease-in-out infinite",
										}}
									/>
									<span
										className="relative w-1.5 h-1.5 rounded-full"
										style={{
											background:
												svc.status === "up" ? "#34d399" : "#fbbf24",
										}}
									/>
								</span>
								<span className="text-[11px] font-mono text-white/80 flex-1 truncate">
									{svc.name}
								</span>
								<span className="text-[10px] font-mono text-white/40 tabular-nums">
									{svc.latency}ms
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
	accent,
}: {
	label: string;
	value: string;
	unit?: string;
	sub: string;
	accent: string;
}) {
	return (
		<div
			className="rounded-xl p-4 relative overflow-hidden"
			style={{
				background: "rgba(255,255,255,0.025)",
				border: "1px solid rgba(255,255,255,0.05)",
			}}
		>
			<div
				aria-hidden
				className="absolute -top-12 -right-8 w-24 h-24 rounded-full blur-2xl"
				style={{ background: `${accent}30` }}
			/>
			<p className="text-[11px] font-medium text-white/45 mb-2 relative">
				{label}
			</p>
			<div className="flex items-baseline gap-1 relative">
				<p className="text-[28px] font-semibold tabular-nums text-white leading-none tracking-tight">
					{value}
				</p>
				{unit && (
					<span className="text-[12px] text-white/40 font-medium">{unit}</span>
				)}
			</div>
			<p
				className="text-[10px] font-mono mt-2 relative"
				style={{ color: accent }}
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
					<stop offset="0%" stopColor={TEAL} stopOpacity="0.35" />
					<stop offset="100%" stopColor={TEAL} stopOpacity="0" />
				</linearGradient>
			</defs>
			<polygon
				fill="url(#mock-area)"
				points={`0,60 ${values
					.map(
						(v, i) =>
							`${(i / (values.length - 1)) * 240},${60 - ((v - min) / range) * 50 - 5}`,
					)
					.join(" ")} 240,60`}
			/>
			<polyline
				fill="none"
				stroke={TEAL}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={values
					.map(
						(v, i) =>
							`${(i / (values.length - 1)) * 240},${60 - ((v - min) / range) * 50 - 5}`,
					)
					.join(" ")}
			/>
		</svg>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats strip

function StatsStrip() {
	const stats = [
		{ icon: Cpu, label: "Agent overhead", value: "<1%", unit: "CPU" },
		{ icon: Shield, label: "Veri aktarımı", value: "TLS", unit: "+ mTLS" },
		{ icon: Activity, label: "Poll", value: "5s", unit: "→ 5dk" },
		{ icon: Zap, label: "Alert SLA", value: "<10s", unit: "" },
	];
	return (
		<section
			className="relative py-16 px-6"
			style={{ background: INK_DEEP }}
		>
			<div
				aria-hidden
				className="absolute top-0 inset-x-0 h-px"
				style={{
					background: `linear-gradient(90deg, transparent, ${TEAL}40, ${VIOLET}40, transparent)`,
				}}
			/>
			<div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
				{stats.map((s, i) => (
					<motion.div
						key={s.label}
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.4, delay: i * 0.05 }}
						className="flex items-center gap-3"
					>
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
							style={{
								background: "rgba(45,212,191,0.08)",
								border: "1px solid rgba(45,212,191,0.18)",
							}}
						>
							<s.icon className="w-4 h-4" style={{ color: TEAL }} />
						</div>
						<div>
							<p className="text-[11px] font-medium text-white/45">{s.label}</p>
							<div className="flex items-baseline gap-1 mt-0.5">
								<p className="text-[20px] font-semibold text-white tabular-nums tracking-tight">
									{s.value}
								</p>
								{s.unit && (
									<span className="text-[11px] text-white/40">{s.unit}</span>
								)}
							</div>
						</div>
					</motion.div>
				))}
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading helper

function SectionHeading({
	eyebrow,
	title,
	highlight,
	accent = TEAL,
}: {
	eyebrow: string;
	title: string;
	highlight?: string;
	accent?: string;
}) {
	return (
		<div className="max-w-3xl mb-16">
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.5 }}
				className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[11px] font-medium mb-5"
				style={{
					background: `${accent}14`,
					color: accent,
					border: `1px solid ${accent}33`,
				}}
			>
				<Sparkles className="w-3 h-3" />
				{eyebrow}
			</motion.div>
			<motion.h2
				initial={{ opacity: 0, y: 16 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.5, delay: 0.1 }}
				className="text-3xl md:text-5xl font-semibold tracking-tight text-white leading-[1.05]"
			>
				{title}
				{highlight && <span className="text-white/35"> {highlight}</span>}
			</motion.h2>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Features

const FEATURES: {
	icon: typeof Activity;
	title: string;
	desc: string;
	color: string;
}[] = [
	{
		icon: Activity,
		title: "Gerçek zamanlı sağlık",
		desc: "Her servisin CPU, bellek, latency ve hata oranı saniyeler içinde paneline akar.",
		color: TEAL,
	},
	{
		icon: Brain,
		title: "AI kök-neden analizi",
		desc: "Uyarı tetiklendiğinde olası nedeni, etkilenen bileşenleri ve çözümü tek tıkla al.",
		color: VIOLET,
	},
	{
		icon: GitBranch,
		title: "Bağımlılık haritası",
		desc: "Servisler arası ilişkileri görselleştir, nokta arızanın domino etkisini önceden gör.",
		color: AMBER,
	},
	{
		icon: Cloud,
		title: "Kubernetes",
		desc: "Pod metrikleri, deployment durumu ve event stream aynı panelde — kubectl'e veda.",
		color: "#60a5fa",
	},
	{
		icon: Bell,
		title: "Akıllı uyarılar",
		desc: "Flapping kontrolü, snooze, Slack ve webhook entegrasyonu. Sinyal var, gürültü yok.",
		color: ROSE,
	},
	{
		icon: Terminal,
		title: "Yapılandırılmış loglar",
		desc: "Tüm servislerden log toplama, severity filtresi, tam metin arama, AI özet.",
		color: "#34d399",
	},
];

function Features() {
	return (
		<section id="features" className="py-32 px-6" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto">
				<SectionHeading
					eyebrow="Her şey dahil"
					title="Tek platform,"
					highlight="altı kritik yetenek."
				/>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
					{FEATURES.map((f, i) => (
						<motion.div
							key={f.title}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: "-50px" }}
							transition={{ duration: 0.45, delay: i * 0.05 }}
							className="group relative rounded-2xl p-7 transition-all hover:-translate-y-1"
							style={{
								background: "rgba(255,255,255,0.02)",
								border: "1px solid rgba(255,255,255,0.06)",
							}}
						>
							<div
								aria-hidden
								className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
								style={{
									background: `radial-gradient(400px circle at 50% 0%, ${f.color}10, transparent 70%)`,
								}}
							/>
							<div className="relative">
								<div
									className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
									style={{
										background: `${f.color}14`,
										border: `1px solid ${f.color}33`,
									}}
								>
									<f.icon className="w-5 h-5" style={{ color: f.color }} />
								</div>
								<h3 className="text-[16px] font-semibold text-white mb-2 tracking-tight">
									{f.title}
								</h3>
								<p className="text-[13px] text-white/55 leading-relaxed">
									{f.desc}
								</p>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works — vertical timeline

function HowItWorks() {
	const steps = [
		{
			n: "01",
			icon: Box,
			title: "Servisi kaydedin",
			desc: "Dashboard'dan host, port ve health endpoint'ini girin. Otuz saniyede tamam.",
			color: TEAL,
		},
		{
			n: "02",
			icon: Terminal,
			title: "Agent'ı kurun",
			desc: "Tek satırlık setup script'i ile sunucuya dağıtın. Binary küçük, daemon hafif.",
			color: VIOLET,
		},
		{
			n: "03",
			icon: Zap,
			title: "İzlemeye başlayın",
			desc: "Metrikler canlı akmaya başlar. AI uyarıların nedenini, harita bağımlılıkları gösterir.",
			color: AMBER,
		},
	];

	return (
		<section id="how" className="relative py-32 px-6" style={{ background: INK_DEEP }}>
			<div
				aria-hidden
				className="absolute inset-x-0 top-0 h-px"
				style={{
					background: `linear-gradient(90deg, transparent, ${TEAL}30, transparent)`,
				}}
			/>
			<div className="max-w-6xl mx-auto">
				<SectionHeading
					eyebrow="Nasıl çalışır"
					title="Üç adımda canlı."
					highlight="Karmaşa yok."
					accent={VIOLET}
				/>

				<div className="grid md:grid-cols-3 gap-6 relative">
					<div
						aria-hidden
						className="hidden md:block absolute top-12 left-[14%] right-[14%] h-px"
						style={{
							background: `linear-gradient(90deg, ${TEAL}, ${VIOLET}, ${AMBER})`,
							opacity: 0.4,
						}}
					/>

					{steps.map((s, i) => (
						<motion.div
							key={s.n}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: "-50px" }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
							className="relative"
						>
							<div
								className="relative w-12 h-12 rounded-2xl flex items-center justify-center mb-5 z-10"
								style={{
									background: INK_DEEP,
									border: `1px solid ${s.color}55`,
									boxShadow: `0 0 0 4px ${s.color}10, 0 0 24px -4px ${s.color}40`,
								}}
							>
								<s.icon className="w-5 h-5" style={{ color: s.color }} />
							</div>
							<div className="flex items-baseline gap-2 mb-2">
								<span
									className="text-[11px] font-mono font-semibold tracking-[0.16em]"
									style={{ color: s.color }}
								>
									{s.n}
								</span>
								<h3 className="text-[18px] font-semibold text-white tracking-tight">
									{s.title}
								</h3>
							</div>
							<p className="text-[14px] text-white/55 leading-relaxed">
								{s.desc}
							</p>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI section

function AISection() {
	return (
		<section id="ai" className="relative py-32 px-6" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
				<motion.div
					initial={{ opacity: 0, x: -16 }}
					whileInView={{ opacity: 1, x: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
				>
					<SectionHeading
						eyebrow="AI kök-neden"
						title="Sadece 'down' demiyoruz —"
						highlight="ne, neden, nasıl?"
						accent={VIOLET}
					/>
					<p className="text-[16px] text-white/55 leading-relaxed mb-8 max-w-xl">
						Claude destekli analiz motoru; metrik, log ve alert geçmişini birleştirip
						olası kök-nedeni, etkilenen bileşenleri ve uygulanabilir çözümü çıkarır.
					</p>
					<ul className="space-y-3.5">
						{[
							"Metrik anomalisi + log pattern korelasyonu",
							"Etkilenen servis ağı görselleştirmesi",
							"Deployment penceresi ile olay eşleştirme",
							"Slack/Teams'e tek mesaj olarak özet",
						].map((item) => (
							<li key={item} className="flex items-start gap-3">
								<div
									className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
									style={{
										background: `${TEAL}14`,
										border: `1px solid ${TEAL}33`,
									}}
								>
									<CheckCircle2 className="w-3 h-3" style={{ color: TEAL }} />
								</div>
								<span className="text-[14px] text-white/75">{item}</span>
							</li>
						))}
					</ul>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, scale: 0.96, y: 16 }}
					whileInView={{ opacity: 1, scale: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.7 }}
				>
					<AIExampleCard />
				</motion.div>
			</div>
		</section>
	);
}

function AIExampleCard() {
	return (
		<div className="relative">
			<div
				aria-hidden
				className="absolute inset-x-8 -top-6 h-20 blur-3xl opacity-50"
				style={{
					background: `radial-gradient(ellipse, ${VIOLET}50, transparent 70%)`,
				}}
			/>
			<div
				className="relative rounded-2xl overflow-hidden"
				style={{
					background: INK_ELEV,
					border: "1px solid rgba(255,255,255,0.08)",
					boxShadow:
						"0 30px 60px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
				}}
			>
				<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
					<div
						className="w-7 h-7 rounded-lg flex items-center justify-center"
						style={{
							background: `${VIOLET}14`,
							border: `1px solid ${VIOLET}33`,
						}}
					>
						<Brain className="w-3.5 h-3.5" style={{ color: VIOLET }} />
					</div>
					<span className="text-[13px] font-semibold text-white/85">
						AI analizi
					</span>
					<div className="flex-1" />
					<span className="text-[10px] font-mono text-white/30">2sn önce</span>
				</div>

				<div className="px-5 py-4 border-b border-white/5">
					<div className="flex items-center gap-2 mb-2">
						<span className="relative flex w-3 h-3 items-center justify-center">
							<span
								className="absolute inset-0 rounded-full"
								style={{
									background: ROSE,
									opacity: 0.3,
									animation: "nn-orb-breathe 2s ease-in-out infinite",
								}}
							/>
							<span
								className="relative w-1.5 h-1.5 rounded-full"
								style={{ background: ROSE }}
							/>
						</span>
						<span
							className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
							style={{
								color: ROSE,
								background: `${ROSE}14`,
							}}
						>
							Kritik
						</span>
						<span className="text-[11px] font-mono text-white/35 ml-auto">
							payments-api · 12:44
						</span>
					</div>
					<p className="text-[14px] text-white font-medium">
						p95 latency 1.2s'ye yükseldi, hata oranı %8
					</p>
				</div>

				<div className="px-5 py-4 space-y-4">
					<div>
						<p className="text-[11px] font-medium text-white/40 mb-1.5">
							Olası kök-neden
						</p>
						<p className="text-[13px] text-white/80 leading-relaxed">
							Son deployment'ta değişen SQL sorgusu yeni bir index kullanıyor
							gibi görünüyor.{" "}
							<code
								className="text-[12px] px-1.5 py-0.5 rounded-md font-mono"
								style={{
									color: TEAL,
									background: `${TEAL}10`,
									border: `1px solid ${TEAL}22`,
								}}
							>
								payments_by_user
							</code>{" "}
							index'i RDS'te yok.
						</p>
					</div>
					<div>
						<p className="text-[11px] font-medium text-white/40 mb-1.5">
							Önerilen aksiyon
						</p>
						<div
							className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
							style={{
								background: `${TEAL}08`,
								border: `1px solid ${TEAL}22`,
							}}
						>
							<ArrowRight
								className="w-3.5 h-3.5 shrink-0 mt-0.5"
								style={{ color: TEAL }}
							/>
							<code className="text-[12px] text-white/85 font-mono flex-1 leading-relaxed">
								CREATE INDEX CONCURRENTLY payments_by_user
								<br />
								&nbsp;&nbsp;ON payments(user_id);
							</code>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Developer section

function DevSection() {
	return (
		<section
			id="devs"
			className="relative py-32 px-6"
			style={{ background: INK_DEEP }}
		>
			<div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
				<motion.div
					initial={{ opacity: 0, x: -16 }}
					whileInView={{ opacity: 1, x: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
				>
					<SectionHeading
						eyebrow="Geliştiriciler için"
						title="Tek script,"
						highlight="sıfır sürpriz."
						accent={TEAL}
					/>
					<p className="text-[16px] text-white/55 leading-relaxed mb-8">
						Tek binary agent. Docker değil, daemon değil — küçük, hafif,
						denetlenebilir. Alt yapınıza girmeden önce kaynak kodunu okuyun.
					</p>
					<div className="grid grid-cols-3 gap-3">
						{[
							{ label: "Binary", value: "6", unit: "MB" },
							{ label: "RAM avg", value: "18", unit: "MB" },
							{ label: "Poll", value: "5", unit: "s" },
						].map((m) => (
							<div
								key={m.label}
								className="p-4 rounded-xl"
								style={{
									background: "rgba(255,255,255,0.02)",
									border: "1px solid rgba(255,255,255,0.06)",
								}}
							>
								<p className="text-[11px] font-medium text-white/40">
									{m.label}
								</p>
								<div className="flex items-baseline gap-1 mt-1">
									<p className="text-2xl font-semibold text-white tabular-nums tracking-tight">
										{m.value}
									</p>
									<span className="text-[11px] text-white/40">{m.unit}</span>
								</div>
							</div>
						))}
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.7 }}
					className="relative"
				>
					<div
						aria-hidden
						className="absolute inset-x-8 -top-6 h-20 blur-3xl opacity-40"
						style={{
							background: `radial-gradient(ellipse, ${TEAL}50, transparent 70%)`,
						}}
					/>
					<div
						className="relative rounded-2xl overflow-hidden"
						style={{
							background: "#02040a",
							border: "1px solid rgba(255,255,255,0.08)",
							boxShadow:
								"0 30px 60px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
						}}
					>
						<div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
							<div className="w-2.5 h-2.5 rounded-full bg-rose-500/30" />
							<div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
							<div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
							<span className="ml-auto text-[10px] font-mono text-white/25 tracking-wide">
								~ / nanonet-agent
							</span>
						</div>
						<pre className="p-5 font-mono text-[12px] leading-[1.7] text-white/75 overflow-x-auto">
							<code>
								<span className="text-white/30"># Agent kurulumu</span>
								{"\n"}
								<span style={{ color: TEAL }}>$</span> ./agent-setup.sh{" "}
								<span className="text-white/40">\</span>
								{"\n   "}
								<span className="text-white/45">--backend</span>{" "}
								<span className="text-white/85">https://api.nanonet.dev</span>{" "}
								<span className="text-white/40">\</span>
								{"\n   "}
								<span className="text-white/45">--token</span>{" "}
								<span className="text-white/85">$NANONET_TOKEN</span>
								{"\n\n"}
								<span className="text-white/40">→ Servis eşleniyor...</span>
								{"\n"}
								<span className="text-white/40">
									→ Binary doğrulanıyor (6.2 MB)
								</span>
								{"\n"}
								<span className="text-white/40">→ systemd unit kuruldu</span>
								{"\n"}
								<span style={{ color: "#34d399" }}>
									✓ nanonet-agent aktif · PID 12847
								</span>
							</code>
						</pre>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA

function CTA({ authed }: { authed: boolean }) {
	return (
		<section
			className="relative py-40 px-6 overflow-hidden"
			style={{ background: INK }}
		>
			<div
				aria-hidden
				className="absolute inset-0 pointer-events-none"
				style={{
					background: `radial-gradient(ellipse 80% 60% at center, ${TEAL}12, ${VIOLET}10, transparent 70%)`,
				}}
			/>
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.7 }}
				className="relative max-w-3xl mx-auto text-center"
			>
				<h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-6">
					Bugün kurun,
					<br />
					<span
						style={{
							background: `linear-gradient(120deg, #ffffff 0%, ${VIOLET} 50%, ${TEAL} 100%)`,
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
						}}
					>
						yarın huzur içinde olun.
					</span>
				</h2>
				<p className="text-[16px] text-white/55 mb-10 max-w-xl mx-auto leading-relaxed">
					Self-hosted, açık kaynak. İlk servisi dakikalar içinde bağlayın —
					hiçbir şeyi bulutumuza göndermeden.
				</p>
				<div className="flex items-center justify-center gap-3 flex-wrap">
					<Link
						to={authed ? "/app" : "/register"}
						className="group inline-flex items-center gap-2 h-12 px-7 rounded-full text-[14px] font-semibold transition-all hover:scale-[1.03]"
						style={{
							background: "#ffffff",
							color: "#0f172a",
							boxShadow:
								"0 12px 40px -8px rgba(45,212,191,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
						}}
					>
						{authed ? "Dashboard'a git" : "Ücretsiz başla"}
						<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
					</Link>
					{!authed && (
						<Link
							to="/login"
							className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-[14px] font-medium text-white/80 hover:text-white transition-colors"
							style={{
								background: "rgba(255,255,255,0.04)",
								border: "1px solid rgba(255,255,255,0.08)",
							}}
						>
							Giriş yap
						</Link>
					)}
				</div>
			</motion.div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer

function Footer() {
	return (
		<footer
			className="border-t border-white/5 py-12 px-6"
			style={{ background: INK_DEEP }}
		>
			<div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
				<div className="flex items-center gap-2.5">
					<img
						src={logo}
						alt=""
						aria-hidden="true"
						className="w-5 h-5 opacity-80"
					/>
					<span className="text-[14px] font-semibold text-white/80">
						NanoNet
					</span>
					<span className="text-[11px] text-white/30 font-mono">v2.0</span>
				</div>
				<div className="flex items-center gap-6">
					{[
						{ label: "Dashboard", to: "/app" },
						{ label: "Servisler", to: "/app/services" },
						{ label: "Uyarılar", to: "/app/alerts" },
					].map((l) => (
						<Link
							key={l.to}
							to={l.to}
							className="text-[12px] text-white/45 hover:text-white/85 transition-colors"
						>
							{l.label}
						</Link>
					))}
				</div>
				<p className="text-[11px] text-white/30 font-mono">
					© 2026 NanoNet · Sinyalin gürültüye karşı zaferi
				</p>
			</div>
		</footer>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function LandingPage() {
	const authed = useAuthStore((s) => s.isAuthenticated);
	const { services } = useServices({ enabled: authed });
	const liveCount = services.filter((s) => s.status === "up").length;

	return (
		<div className="antialiased" style={{ background: INK, color: "#fff" }}>
			<style>{`
				@keyframes nn-orb-breathe {
					0%, 100% { transform: scale(0.85); opacity: 0.25; }
					50% { transform: scale(1.35); opacity: 0.5; }
				}
			`}</style>
			<Nav authed={authed} />
			<main>
				<Hero authed={authed} liveCount={liveCount} />
				<StatsStrip />
				<Features />
				<HowItWorks />
				<AISection />
				<DevSection />
				<CTA authed={authed} />
			</main>
			<Footer />
		</div>
	);
}
