import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	Brain,
	CheckCircle2,
	Cpu,
	Database,
	Gauge,
	GitFork,
	LayoutGrid,
	Network,
	Terminal,
	TrendingDown,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import logo from "@/assets/logo.png";
import landingVideo from "@/assets/video/landing.mp4";
import dashboardImage from "@/assets/image.png";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useServices } from "@/hooks/useServices";

export function LandingPage() {
	const { t } = useTranslation();
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const { services } = useServices({ enabled: isAuthenticated });

	const activeServicesCount = services.filter((s) => s.status === "up")
		.length;

	return (
		<div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500/30 font-sans">
			{/* Floating TopNavBar */}
			<div className="fixed top-6 inset-x-6 z-50 pointer-events-none">
				<nav
					className="max-w-7xl mx-auto pointer-events-auto bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-300"
					style={{
						boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
					}}
				>
					<div className="flex justify-between items-center w-full px-6 py-3">
						<div className="flex items-center gap-10">
							<div className="flex items-center gap-2.5 shrink-0">
								<img src={logo} alt="NanoNet Logo" className="w-8 h-8" />
								<span className="text-xl font-black bg-gradient-to-br from-indigo-600 to-cyan-500 bg-clip-text text-transparent tracking-tighter">
									NanoNet
								</span>
							</div>
							<div className="hidden lg:flex gap-8 items-center pt-0.5">
								<a
									className="text-indigo-600 dark:text-cyan-400 font-bold text-xs uppercase tracking-widest border-b-2 border-indigo-600 dark:border-cyan-400 pb-1"
									href="/"
								>
									{t("navigation.platform")}
								</a>
								{["Observability", "Solutions", "Developers", "Pricing"].map(
									(item) => (
										<a
											key={item}
											className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-xs font-bold uppercase tracking-widest"
											href="/"
										>
											{item}
										</a>
									),
								)}
							</div>
						</div>
						<div className="flex items-center gap-4">
							{isAuthenticated ? (
								<div key="auth-cta">
									<Link to="/app">
										<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 h-10 font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
											{t("landing.hero.cta.launch")}
										</Button>
									</Link>
								</div>
							) : (
								<div key="guest-cta" className="flex items-center gap-4">
									<Link
										to="/login"
										className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors px-2"
									>
										{t("auth.login")}
									</Link>
									<Link to="/register">
										<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 h-10 font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
											{t("auth.register")}
										</Button>
									</Link>
								</div>
							)}
						</div>
					</div>
				</nav>
			</div>

			{/* Hero Section */}
			<section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
				{/* Abstract Background */}
				<div className="absolute inset-0 z-0 bg-[#05060f]">
					<div
						className="absolute inset-0 opacity-20"
						style={{
							backgroundImage:
								"radial-gradient(circle at 2px 2px, #4f46e5 1px, transparent 0)",
							backgroundSize: "40px 40px",
						}}
					/>
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full" />
				</div>

				<div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center w-full">
					<motion.div
						key="hero-text-content"
						initial={{ opacity: 0, x: -30 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.8, ease: "easeOut" }}
						className="flex flex-col justify-center"
					>
						<div className="mb-6">
							{isAuthenticated ? (
								<motion.div
									initial={{ opacity: 0, y: -10 }}
									animate={{ opacity: 1, y: 0 }}
									className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full"
								>
									<div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
									<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
										{activeServicesCount} {t("status.active")} Services
									</span>
								</motion.div>
							) : (
								<span className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-500">
									{t("landing.hero.badge")}
								</span>
							)}
						</div>
						<h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-4">
							{t("landing.hero.title")}
						</h1>
						<p className="text-2xl md:text-3xl font-medium text-slate-300 tracking-tight leading-snug">
							{t("landing.hero.subtitle")}
						</p>
						<p className="text-lg text-slate-400 mt-8 mb-10 leading-relaxed max-w-lg">
							{t("landing.hero.description")}
						</p>
						<div className="flex flex-wrap gap-4" key="landing-cta-group">
							{isAuthenticated ? (
								<div key="auth-launch">
									<Link to="/app">
										<Button className="h-auto px-8 py-4 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 transition-transform">
											{t("landing.hero.cta.launch")}
										</Button>
									</Link>
								</div>
							) : (
								<div key="guest-demo">
									<Link to="/login">
										<Button className="h-auto px-8 py-4 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 transition-transform">
											{t("landing.hero.cta.start")}
										</Button>
									</Link>
								</div>
							)}
							<a
								href="https://github.com/kaelvalen/nanonet"
								target="_blank"
								rel="noreferrer"
							>
								<Button
									variant="outline"
									className="h-auto px-8 py-4 rounded-lg border-2 border-slate-800 text-slate-300 font-bold text-lg hover:bg-slate-800 transition-colors"
								>
									{t("landing.hero.cta.more")}
								</Button>
							</a>
						</div>
					</motion.div>

					{/* Pulsing Node Map */}
					<motion.div
						key="hero-visual-container"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 1, delay: 0.2 }}
						className="hidden md:flex justify-center relative"
					>
						<div className="w-full relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black aspect-video group">
							<video
								autoPlay
								muted
								loop
								playsInline
								className="w-full h-full object-cover opacity-60 transition-opacity duration-700 group-hover:opacity-80"
							>
								<source src={landingVideo} type="video/mp4" />
							</video>

							{/* Gradient Overlays for depth */}
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
							<div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 mix-blend-overlay pointer-events-none" />

							{/* HUD Overlay Elements */}
							<div className="absolute inset-0 z-20">
								<FloatingNode
									delay={0}
									icon={<Network className="w-4 h-4" />}
									label="API_GW"
									pos="top-[15%] left-[10%]"
								/>
								<FloatingNode
									delay={1.5}
									icon={<Database className="w-4 h-4" />}
									label="AUTH_DB"
									pos="bottom-[20%] left-[15%]"
								/>
								<FloatingNode
									delay={0.8}
									icon={<Cpu className="w-4 h-4" />}
									label="K8S_NODE_A"
									pos="top-[25%] right-[10%]"
								/>
								<FloatingNode
									delay={2.2}
									icon={<Zap className="w-4 h-4" />}
									label="LATENCY_OK"
									pos="bottom-[30%] right-[15%]"
								/>
							</div>

							{/* Decoration */}
							<div className="absolute top-4 right-4 flex gap-1.5 opacity-40">
								<div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
								<div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse delay-75" />
								<div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse delay-150" />
							</div>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Problem Bar */}
			<section className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
				<div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
					<h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
						{t("landing.problem.question")}
					</h3>
					<div className="flex flex-wrap justify-center items-center gap-10">
						{[
							{ icon: Gauge, label: t("landing.problem.latency") },
							{ icon: TrendingDown, label: t("landing.problem.drift") },
							{ icon: AlertTriangle, label: t("landing.problem.outages") },
						].map((item) => (
							<div key={item.label} className="flex items-center gap-3">
								<item.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
								<span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
									{item.label}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Feature Grid */}
			<section className="py-24 bg-white dark:bg-slate-950">
				<div className="max-w-7xl mx-auto px-6">
					<div className="mb-16">
						<span className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
							{t("landing.features.badge")}
						</span>
						<h2 className="text-4xl font-bold mt-2 tracking-tight">
							{t("landing.features.title")}
						</h2>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
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
						].map((f, i) => (
							<motion.div
								key={f.title}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: i * 0.1 }}
								className="p-8 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all group cursor-default"
							>
								<div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center mb-6 text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
									<f.icon className="w-6 h-6" />
								</div>
								<h4 className="text-lg font-bold mb-3">{f.title}</h4>
								<p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
									{f.desc}
								</p>
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* Live Demo Strip */}
			<section className="bg-[#0a0c10] py-24 overflow-hidden">
				<div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
					<div className="space-y-10">
						<h2 className="text-4xl font-bold text-white mb-8 tracking-tight">
							{t("landing.setup.title")}
						</h2>
						<div className="space-y-8">
							{[
								{
									n: 1,
									title: t("landing.setup.step1.title"),
									desc: t("landing.setup.step1.desc"),
								},
								{
									n: 2,
									title: t("landing.setup.step2.title"),
									desc: t("landing.setup.step2.desc"),
								},
								{
									n: 3,
									title: t("landing.setup.step3.title"),
									desc: t("landing.setup.step3.desc"),
								},
							].map((step) => (
								<div key={step.n} className="flex gap-6">
									<div className="flex-shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-cyan-400 font-bold">
										{step.n}
									</div>
									<div>
										<h5 className="text-white font-bold mb-1">{step.title}</h5>
										<p className="text-slate-400 text-sm">{step.desc}</p>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="relative group">
						<div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-20 blur-2xl group-hover:opacity-30 transition-opacity" />
						<div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-white/5">
							<div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 opacity-60" />
							<div className="p-2 bg-slate-800/50 flex gap-1.5 border-b border-white/5">
								<div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
								<div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
								<div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
							</div>
							<img
								alt="Dashboard Mockup"
								className="w-full h-auto opacity-90 group-hover:opacity-100 blur-sm group-hover:blur-none transition-all duration-700"
								src={dashboardImage}
							/>
						</div>
					</div>
				</div>
			</section>

			{/* AI Insights Spotlight */}
			<section className="py-24 bg-slate-50 dark:bg-slate-900/50">
				<div className="max-w-4xl mx-auto px-6 text-center">
					<div className="mb-12 inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-200 dark:border-indigo-500/20">
						<Zap className="w-3.5 h-3.5 text-indigo-600" />
						<span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
							{t("landing.ai.badge")}
						</span>
					</div>
					<h2 className="text-5xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter leading-tight">
						{t("landing.ai.title")}
					</h2>
					<motion.div
						whileHover={{ y: -5 }}
						className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-xl text-left relative overflow-hidden"
					>
						<div className="flex items-start gap-6 relative z-10">
							<div className="w-12 h-12 flex-shrink-0 bg-red-100 dark:bg-red-500/10 text-red-600 rounded-xl flex items-center justify-center">
								<AlertTriangle className="w-6 h-6" />
							</div>
							<div className="space-y-4 flex-1">
								<div className="flex items-center gap-3">
									<span className="text-sm font-bold text-red-600 uppercase tracking-wide">
										{t("landing.ai.alert.title")}
									</span>
									<div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
									<span className="text-xs font-mono text-slate-500">
										12:44:02 UTC
									</span>
								</div>
								<h4 className="text-xl font-bold">
									{t("landing.ai.alert.desc")}
								</h4>
								<div className="flex items-center gap-4 py-4">
									<div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3 rounded-lg flex-1 flex items-center gap-3">
										<ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
										<p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
											{t("landing.ai.alert.insight")}
										</p>
									</div>
								</div>
							</div>
						</div>
						<div className="absolute -bottom-10 -right-10 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
					</motion.div>
				</div>
			</section>

			{/* Agent Install */}
			<section className="py-24 bg-white dark:bg-slate-950">
				<div className="max-w-7xl mx-auto px-6">
					<div className="grid lg:grid-cols-2 gap-16 items-center">
						<div className="space-y-8">
							<h2 className="text-4xl font-bold tracking-tight">
								{t("landing.devs.title")}
							</h2>
							<p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
								{t("landing.devs.desc")}
							</p>
							<ul className="space-y-5">
								{[
									t("landing.devs.feature1"),
									t("landing.devs.feature2"),
									t("landing.devs.feature3"),
								].map((item) => (
									<li key={item} className="flex items-center gap-3">
										<CheckCircle2 className="w-5 h-5 text-emerald-500" />
										<span className="font-medium">{item}</span>
									</li>
								))}
							</ul>
						</div>
						<div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-2xl">
							<div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
								<div className="flex gap-2">
									<div className="w-3 h-3 rounded-full bg-slate-700" />
									<div className="w-3 h-3 rounded-full bg-slate-700" />
									<div className="w-3 h-3 rounded-full bg-slate-700" />
								</div>
								<span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
									bash — 80x24
								</span>
							</div>
							<div className="font-mono text-sm space-y-3">
								<p className="text-slate-500"># {t("landing.devs.install.comment")}</p>
								<div className="flex items-center gap-3 bg-slate-950 p-4 rounded border border-slate-800 group relative">
									<span className="text-indigo-500 font-bold">$</span>
									<code className="text-slate-200">
										curl -sSL https://get.nanonet.dev | bash
									</code>
									<button
										type="button"
										className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-800 rounded text-slate-400"
										onClick={() =>
											navigator.clipboard.writeText(
												"curl -sSL https://get.nanonet.dev | bash",
											)
										}
										title="Copy command"
									>
										<Terminal className="w-4 h-4" />
									</button>
								</div>
								<div className="pt-4 space-y-1 text-xs">
									<p className="text-slate-500">
										&gt;&gt; {t("landing.devs.install.step1")}
									</p>
									<p className="text-slate-500">
										&gt;&gt; {t("landing.devs.install.step2")}
									</p>
									<p className="text-cyan-500 font-bold">
										&gt;&gt; {t("landing.devs.install.success")}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
				<div className="w-full px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto">
					<div className="flex flex-col md:flex-row items-center gap-8">
						<div className="flex items-center gap-2">
							<img
								src={logo}
								alt="Logo"
								className="w-6 h-6 grayscale opacity-70"
							/>
							<span className="text-lg font-black text-slate-900 dark:text-slate-100">
								NanoNet
							</span>
						</div>
						<span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
							NanoNet v2.0 · {t("footer.tagline")}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-8">
						{[
							{ key: "navigation.dashboard", path: "/app" },
							{ key: "navigation.services", path: "/app/services" },
							{ key: "navigation.alerts", path: "/app/alerts" },
						].map((link) => (
							<Link
								key={link.key}
								to={link.path}
								className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors"
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

function FloatingNode({
	icon,
	label,
	pos,
	delay,
}: {
	icon: React.ReactNode;
	label: string;
	pos: string;
	delay: number;
}) {
	return (
		<motion.div
			key={`fn-${label}`}
			initial={{ opacity: 0, y: 10 }}
			animate={{
				opacity: 1,
				y: [0, -10, 0],
			}}
			transition={{
				duration: 4,
				repeat: Infinity,
				delay,
				opacity: { duration: 1 },
			}}
			className={`absolute ${pos} bg-white/10 backdrop-blur-md border border-white/10 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xl z-20`}
		>
			<div className="text-cyan-400">{icon}</div>
			<span className="text-[10px] font-bold text-white tracking-widest">
				{label}
			</span>
		</motion.div>
	);
}
