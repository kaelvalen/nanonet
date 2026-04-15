import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	Brain,
	CheckCircle2,
	ChevronDown,
	GitFork,
	LayoutGrid,
	Terminal,
	Zap,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import dashboardImage from "@/assets/image.png";
import logo from "@/assets/logo.png";
import landingVideo from "@/assets/video/landing.mp4";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
	const { t } = useTranslation();
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 50);
		};
		handleScroll();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const scrollTo = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
	};

	const dark = scrolled;
	return (
		<div className="fixed top-6 inset-x-6 z-50 pointer-events-none">
			<nav
				className={`max-w-6xl mx-auto pointer-events-auto flex items-center justify-between px-6 py-3.5 backdrop-blur-2xl rounded-2xl transition-all duration-500 ${
					dark
						? "bg-white/95 border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
						: "bg-white/5 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
				}`}
			>
				{/* Logo */}
				<div className="flex items-center gap-2.5">
					<img src={logo} alt="NanoNet" className="w-7 h-7" />
					<span
						className={`font-black text-base tracking-tighter transition-colors duration-500 ${dark ? "text-slate-900" : "text-white"}`}
					>
						NanoNet
					</span>
				</div>

				{/* Nav links */}
				<div className="hidden md:flex items-center gap-8">
					{(
						[
							{ label: "Platform", id: "hero" },
							{ label: "Observability", id: "features" },
							{ label: "Docs", id: "setup" },
							{ label: "Pricing", id: "cta" },
						] as const
					).map(({ label, id }) => (
						<button
							key={label}
							type="button"
							onClick={() => scrollTo(id)}
							className="text-[11px] font-bold uppercase tracking-widest transition-colors"
							style={{ color: dark ? "#64748b" : "rgba(255, 255, 255, 0.7)" }}
						>
							{label}
						</button>
					))}
				</div>

				{/* CTA */}
				<div className="flex items-center gap-4">
					{isAuthenticated ? (
						<Link to="/app">
							<Button
								className={`h-9 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
									dark
										? "bg-teal-600 text-white hover:bg-teal-700"
										: "bg-white text-slate-900 hover:bg-slate-100"
								}`}
							>
								{t("landing.hero.cta.launch")}
							</Button>
						</Link>
					) : (
						<>
							<Link
								to="/login"
								className="text-[11px] font-bold uppercase tracking-widest transition-colors"
								style={{ color: dark ? "#334155" : "#ffffff" }}
							>
								{t("auth.login")}
							</Link>
							<Link to="/register">
								<Button
									className={`h-9 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
										dark
											? "bg-teal-600 text-white hover:bg-teal-700"
											: "bg-white text-slate-900 hover:bg-slate-100"
									}`}
								>
									{t("auth.register")}
								</Button>
							</Link>
						</>
					)}
				</div>
			</nav>
		</div>
	);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
	isAuthenticated,
	activeServicesCount,
}: {
	isAuthenticated: boolean;
	activeServicesCount: number;
}) {
	const { t } = useTranslation();
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end start"],
	});
	const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
	const textY = useTransform(scrollYProgress, [0, 0.5], [0, -40]);

	return (
		<section
			id="hero"
			ref={ref}
			className="relative min-h-screen w-full bg-[#060810] flex items-center overflow-hidden"
		>
			{/* Subtle background texture */}
			<div
				className="absolute inset-0 opacity-[0.035]"
				style={{
					backgroundImage: "radial-gradient(rgba(13,148,136,0.18) 1px, transparent 0)",
					backgroundSize: "32px 32px",
				}}
			/>

			{/* Radial glow */}
			<div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-150 h-150 bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />

			<motion.div
				style={{ opacity, y: textY }}
				className="relative z-10 w-full max-w-7xl mx-auto px-8 lg:px-14 grid lg:grid-cols-2 gap-16 items-center pt-28 pb-16"
			>
				{/* Left: Text */}
				<div>
					{/* Badge */}
					{isAuthenticated ? (
						<motion.div
							initial={{ opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
							className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full mb-8"
						>
							<motion.div
								animate={{ opacity: [1, 0.4, 1] }}
								transition={{ duration: 1.5, repeat: Infinity }}
								className="w-1.5 h-1.5 rounded-full bg-emerald-400"
							/>
							<span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
								{activeServicesCount} services running
							</span>
						</motion.div>
					) : (
						<motion.div
							initial={{ opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
							className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full mb-8"
						>
							<Zap className="w-3 h-3 text-teal-400" />
							<span className="text-[10px] font-black text-teal-400/70 uppercase tracking-[0.2em]">
								{t("landing.hero.badge")}
							</span>
						</motion.div>
					)}

					{/* Title */}
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
						className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.93] mb-6"
					>
						{t("landing.hero.title")}
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.55 }}
						className="text-base md:text-lg text-white/45 font-medium leading-relaxed max-w-md"
					>
						{t("landing.hero.subtitle")}
					</motion.p>

					{/* CTAs */}
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.7 }}
						className="flex items-center gap-4 mt-10"
					>
						{isAuthenticated ? (
							<Link to="/app">
								<Button className="h-11 px-7 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-black text-sm transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(13,148,136,0.4)]">
									{t("landing.hero.cta.launch")} →
								</Button>
							</Link>
						) : (
							<>
								<Link to="/register">
									<Button className="h-11 px-7 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-black text-sm transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(13,148,136,0.4)]">
										{t("landing.hero.cta.start")} →
									</Button>
								</Link>
								<Link to="/login" className="h-11 px-5 rounded-xl flex items-center text-sm font-bold transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.55)" }}>
									{t("auth.login")} →
								</Link>
							</>
						)}
					</motion.div>
				</div>

				{/* Right: Video in frame */}
				<motion.div
					initial={{ opacity: 0, x: 30 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
					className="hidden lg:block relative group"
				>
					{/* Ambient glow behind the card */}
					<div className="absolute -inset-4 bg-teal-500/10 blur-3xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

					{/* Card frame */}
					<div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
						{/* Chrome bar */}
						<div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/4 border-b border-white/5">
							<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
							<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
							<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
							<div className="flex-1 mx-3 h-5 bg-white/4 rounded-md" />
							<span className="text-[9px] font-mono text-white/15 uppercase tracking-widest">
								NanoNet Console
							</span>
						</div>

						{/* Video */}
						<video
							autoPlay
							muted
							loop
							playsInline
							className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 blur-[2px] group-hover:blur-none transition-all duration-700"
						>
							<source src={landingVideo} type="video/mp4" />
						</video>

						{/* Bottom gradient fade */}
						<div className="absolute bottom-0 inset-x-0 h-12 bg-linear-to-t from-[#060810]/60 to-transparent pointer-events-none" />
					</div>
				</motion.div>
			</motion.div>

			{/* Scroll cue */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.2 }}
				className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
			>
				<motion.div
					animate={{ y: [0, 6, 0] }}
					transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
				>
					<ChevronDown className="w-5 h-5 text-white/25" />
				</motion.div>
			</motion.div>
		</section>
	);
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({
	icon: Icon,
	title,
	desc,
	delay = 0,
}: {
	icon: React.ElementType;
	title: string;
	desc: string;
	delay?: number;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-60px" }}
			transition={{ delay, duration: 0.5, ease: "easeOut" }}
			className="group p-7 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-50 transition-all duration-300 cursor-default bg-white"
		>
			<div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-teal-50 border border-slate-100 group-hover:border-teal-100 flex items-center justify-center mb-5 transition-colors">
				<Icon className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" />
			</div>
			<h4 className="text-[15px] font-black text-slate-900 mb-2 tracking-tight">
				{title}
			</h4>
			<p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
		</motion.div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
	const { t } = useTranslation();
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const { services } = useServices({ enabled: isAuthenticated });
	const activeServicesCount = services.filter((s) => s.status === "up").length;

	const features = [
		{
			icon: Activity,
			title: t("landing.features.health.title"),
			desc: t("landing.features.health.desc"),
		},
		{
			icon: Brain,
			title: t("landing.features.ai.title"),
			desc: t("landing.features.ai.desc"),
		},
		{
			icon: GitFork,
			title: t("landing.features.serviceMap.title"),
			desc: t("landing.features.serviceMap.desc"),
		},
		{
			icon: LayoutGrid,
			title: t("landing.features.k8s.title"),
			desc: t("landing.features.k8s.desc"),
		},
		{
			icon: Bell,
			title: t("landing.features.alerts.title"),
			desc: t("landing.features.alerts.desc"),
		},
		{
			icon: Terminal,
			title: t("landing.features.logs.title"),
			desc: t("landing.features.logs.desc"),
		},
	];

	const steps = [
		{
			n: "01",
			title: t("landing.setup.step1.title"),
			desc: t("landing.setup.step1.desc"),
		},
		{
			n: "02",
			title: t("landing.setup.step2.title"),
			desc: t("landing.setup.step2.desc"),
		},
		{
			n: "03",
			title: t("landing.setup.step3.title"),
			desc: t("landing.setup.step3.desc"),
		},
	];

	return (
		<div className="bg-white text-slate-900 antialiased font-sans">
			<Navbar isAuthenticated={isAuthenticated} />
			<Hero
				isAuthenticated={isAuthenticated}
				activeServicesCount={activeServicesCount}
			/>

			{/* ── Features ── */}
			<section id="features" className="py-28 bg-white">
				<div className="max-w-6xl mx-auto px-6">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						className="mb-16"
					>
						<p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-600 mb-3">
							{t("landing.features.badge")}
						</p>
						<h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter max-w-xl">
							{t("landing.features.title")}
						</h2>
					</motion.div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{features.map((f, i) => (
							<FeatureCard key={f.title} {...f} delay={i * 0.07} />
						))}
					</div>
				</div>
			</section>

			{/* ── Setup ── */}
			<section id="setup" className="py-28 bg-[#060810]">
				<div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
					{/* Steps */}
					<div>
						<p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-400 mb-4">
							{t("landing.setup.badge")}
						</p>
						<h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-14">
							{t("landing.setup.title")}
						</h2>
						<div className="space-y-10">
							{steps.map((step, i) => (
								<motion.div
									key={step.n}
									initial={{ opacity: 0, x: -20 }}
									whileInView={{ opacity: 1, x: 0 }}
									viewport={{ once: true }}
									transition={{ delay: i * 0.1 }}
									className="flex gap-6"
								>
									<span className="text-3xl font-black text-white/5 leading-none select-none tabular-nums">
										{step.n}
									</span>
									<div className="pt-0.5">
										<h5 className="text-white font-black tracking-tight mb-1.5">
											{step.title}
										</h5>
										<p className="text-sm text-white/40 leading-relaxed">
											{step.desc}
										</p>
									</div>
								</motion.div>
							))}
						</div>
					</div>

					{/* Dashboard preview */}
					<motion.div
						initial={{ opacity: 0, scale: 0.97 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
						className="relative group"
					>
						<div className="absolute -inset-6 bg-teal-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
						<div className="relative rounded-2xl border border-white/5 overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
							<div className="flex items-center gap-1.5 px-4 py-3 bg-white/3 border-b border-white/5">
								<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
								<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
								<div className="w-2.5 h-2.5 rounded-full bg-white/10" />
								<span className="ml-auto text-[9px] font-mono text-white/20 uppercase tracking-widest">
									NanoNet Console
								</span>
							</div>
							<img
								src={dashboardImage}
								alt="Dashboard"
								className="w-full h-auto opacity-80 group-hover:opacity-100 blur-[2px] group-hover:blur-none transition-all duration-700"
							/>
						</div>
					</motion.div>
				</div>
			</section>

			{/* ── AI Insights ── */}
			<section id="ai" className="py-28 bg-slate-50">
				<div className="max-w-4xl mx-auto px-6 text-center">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
					>
						<div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 px-4 py-1.5 rounded-full mb-8">
							<Zap className="w-3 h-3 text-teal-600" />
							<span className="text-[10px] font-black uppercase tracking-widest text-teal-600">
								{t("landing.ai.badge")}
							</span>
						</div>
						<h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">
							{t("landing.ai.title")}
						</h2>
						<p className="text-slate-500 text-base leading-relaxed mb-12 max-w-2xl mx-auto">
							{t("landing.ai.desc")}
						</p>
						<div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-xl text-left">
							<div className="flex items-start gap-5">
								<div className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shrink-0">
									<AlertTriangle className="w-5 h-5 text-red-500" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3 mb-3">
										<span className="text-xs font-black text-red-500 uppercase tracking-widest">
											{t("landing.ai.alert.title")}
										</span>
										<div className="h-px flex-1 bg-slate-100" />
										<span className="text-[10px] font-mono text-slate-400">
											12:44:02 UTC
										</span>
									</div>
									<p className="font-black text-slate-900 text-[15px] mb-4 tracking-tight">
										{t("landing.ai.alert.desc")}
									</p>
									<div className="bg-teal-50 border border-teal-100 px-4 py-3 rounded-xl flex items-start gap-3">
										<ArrowRight className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
										<p className="text-sm text-slate-600 leading-relaxed">
											{t("landing.ai.alert.insight")}
										</p>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			</section>

			{/* ── Developer ── */}
			<section id="devs" className="py-28 bg-white">
				<div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-start">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
					>
						<h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-5">
							{t("landing.devs.title")}
						</h2>
						<p className="text-slate-500 text-base leading-relaxed mb-10">
							{t("landing.devs.desc")}
						</p>
						<ul className="space-y-4">
							{[
								t("landing.devs.feature1"),
								t("landing.devs.feature2"),
								t("landing.devs.feature3"),
							].map((item) => (
								<li key={item} className="flex items-center gap-3">
									<CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
									<span className="text-sm font-semibold text-slate-700">
										{item}
									</span>
								</li>
							))}
						</ul>
					</motion.div>

					{/* Terminal */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ delay: 0.1 }}
						className="bg-[#0d1117] rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
					>
						<div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/5">
							<div className="w-3 h-3 rounded-full bg-red-500/40" />
							<div className="w-3 h-3 rounded-full bg-amber-500/40" />
							<div className="w-3 h-3 rounded-full bg-emerald-500/40" />
							<span className="ml-auto text-[9px] font-mono text-white/20 uppercase tracking-widest">
								bash
							</span>
						</div>
						<div className="p-6 font-mono text-sm space-y-4">
							<p className="text-white/30">
								# {t("landing.devs.install.comment")}
							</p>
							<div className="flex items-center gap-3 bg-white/3 border border-white/5 px-4 py-3.5 rounded-xl group relative">
								<span className="text-teal-400 font-bold select-none">$</span>
								<code className="text-white/80 flex-1">
									curl -sSL https://get.nanonet.dev | bash
								</code>
								<button
									type="button"
									onClick={() =>
										navigator.clipboard.writeText(
											"curl -sSL https://get.nanonet.dev | bash",
										)
									}
									className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/60 p-1"
									title="Copy"
								>
									<Terminal className="w-3.5 h-3.5" />
								</button>
							</div>
							<div className="space-y-1.5 pt-1">
								<p className="text-white/25 text-xs">
									→ {t("landing.devs.install.step1")}
								</p>
								<p className="text-white/25 text-xs">
									→ {t("landing.devs.install.step2")}
								</p>
								<p className="text-emerald-400 font-bold text-xs">
									✓ {t("landing.devs.install.success")}
								</p>
							</div>
						</div>
					</motion.div>
				</div>
			</section>

			{/* ── CTA Banner ── */}
			<section id="cta" className="py-32 bg-[#060810] relative overflow-hidden">
				<div className="absolute inset-0 pointer-events-none">
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-teal-600/8 blur-[120px] rounded-full" />
				</div>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="relative max-w-3xl mx-auto px-6 text-center"
				>
					<div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full mb-8">
						<span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
						<span className="text-[10px] font-black uppercase tracking-widest text-teal-400">
							Free to start
						</span>
					</div>
					<h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-[1.1]">
						{t("landing.cta.title")}
					</h2>
					<p className="text-white/40 text-base mb-12 leading-relaxed">
						{t("landing.hero.description")}
					</p>
					<div className="flex items-center justify-center gap-4 flex-wrap">
						<Link to={isAuthenticated ? "/app" : "/register"}>
							<Button className="h-12 px-10 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-black text-sm tracking-wide transition-all active:scale-[0.98] shadow-[0_0_40px_rgba(13,148,136,0.35)]">
								{isAuthenticated
									? t("landing.hero.cta.launch")
									: t("landing.hero.cta.start")}{" "}
								→
							</Button>
						</Link>
						{!isAuthenticated && (
							<Link to="/login" className="text-sm font-semibold text-white/40 hover:text-white/70 transition-colors">
								{t("auth.login")} →
							</Link>
						)}
					</div>
				</motion.div>
			</section>

			{/* ── Footer ── */}
			<footer className="border-t border-slate-100 bg-white">
				<div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
					<div className="flex items-center gap-2.5">
						<img src={logo} alt="Logo" className="w-5 h-5 opacity-50" />
						<span className="text-sm font-black text-slate-600 tracking-tight">
							NanoNet
						</span>
						<span className="text-xs text-slate-400 ml-2 font-mono">
							v2.0 · {t("footer.tagline")}
						</span>
					</div>
					<div className="flex items-center gap-8">
						{[
							{ key: "navigation.dashboard", path: "/app" },
							{ key: "navigation.services", path: "/app/services" },
							{ key: "navigation.alerts", path: "/app/alerts" },
						].map((link) => (
							<Link
								key={link.key}
								to={link.path}
								className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
							>
								{t(link.key)}
							</Link>
						))}
					</div>
				</div>
			</footer>
		</div>
	);
}
