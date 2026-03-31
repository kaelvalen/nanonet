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
import logo from "@/assets/logo.png";
import landingVideo from "@/assets/video/landing.mp4";
import dashboardImage from "@/assets/image.png";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

export function LandingPage() {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

	return (
		<div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500/30 font-sans">
			{/* TopNavBar */}
			<nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-all duration-200">
				<div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
					<div className="flex items-center gap-8">
						<div className="flex items-center gap-2.5">
							<img src={logo} alt="NanoNet Logo" className="w-8 h-8" />
							<span className="text-xl font-bold bg-gradient-to-br from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
								NanoNet
							</span>
						</div>
						<div className="hidden md:flex gap-6 items-center">
							<a
								className="text-indigo-600 dark:text-cyan-400 font-semibold border-b-2 border-indigo-600 dark:border-cyan-400 pb-1 text-sm tracking-tight"
								href="/"
							>
								Platform
							</a>
							{["Observability", "Solutions", "Developers", "Pricing"].map(
								(item) => (
									<a
										key={item}
										className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-sm font-medium tracking-tight"
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
									<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2 font-medium text-sm transition-all active:scale-95">
										Go to Dashboard
									</Button>
								</Link>
							</div>
						) : (
							<div key="guest-cta">
								<Link to="/login">
									<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2 font-medium text-sm transition-all active:scale-95">
										Get Started
									</Button>
								</Link>
							</div>
						)}
					</div>
				</div>
			</nav>

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
						className="space-y-8"
					>
						<div>
							<h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-4">
								NanoNet
							</h1>
							<p className="text-2xl md:text-3xl font-medium text-slate-300 tracking-tight">
								See the noise.{" "}
								<span className="text-cyan-400">Find the signal.</span>
							</p>
						</div>
						<p className="text-lg text-slate-400 max-w-md leading-relaxed">
							The next generation of industrial-grade observability. Stop
							guessing and start knowing with sub-second precision and AI-driven
							root cause analysis.
						</p>
						<div className="flex flex-wrap gap-4" key="landing-cta-group">
							{isAuthenticated ? (
								<div key="auth-launch">
									<Link to="/app">
										<Button className="h-auto px-8 py-4 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 transition-transform">
											Launch Console
										</Button>
									</Link>
								</div>
							) : (
								<div key="guest-demo">
									<Link to="/login">
										<Button className="h-auto px-8 py-4 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 transition-transform">
											Start Demo
										</Button>
									</Link>
								</div>
							)}
							<Button
								variant="outline"
								className="h-auto px-8 py-4 rounded-lg border border-slate-700 text-slate-200 font-bold text-lg hover:bg-slate-800 transition-colors flex items-center gap-2 bg-transparent"
								onClick={() =>
									window.open("https://github.com/kaelvalen/nanonet", "_blank")
								}
							>
								<Terminal className="w-5 h-5" /> GitHub
							</Button>
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
						Are your users discovering critical failures before you do?
					</h3>
					<div className="flex flex-wrap justify-center items-center gap-10">
						{[
							{ icon: Gauge, label: "Latency Spikes" },
							{ icon: TrendingDown, label: "Data Drift" },
							{ icon: AlertTriangle, label: "Ghost Outages" },
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
							Engineered for Scale
						</span>
						<h2 className="text-4xl font-bold mt-2 tracking-tight">
							Precision Monitoring Tools
						</h2>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								icon: Activity,
								title: "Health Monitoring",
								desc: "Continuous verification of system vitality with custom threshold triggers.",
							},
							{
								icon: Brain,
								title: "AI Anomaly Detection",
								desc: "Neural patterns identify deviation before they impact customer experience.",
							},
							{
								icon: GitFork,
								title: "Service Dependency Map",
								desc: "Visualize the complex graph of your microservices in real-time.",
							},
							{
								icon: LayoutGrid,
								title: "Kubernetes Integration",
								desc: "Native support for clusters with auto-discovery and pod-level metrics.",
							},
							{
								icon: Bell,
								title: "Real-time Alerts",
								desc: "Low-latency delivery via Slack, PagerDuty, or custom Webhooks.",
							},
							{
								icon: Terminal,
								title: "Log Viewer",
								desc: "High-performance log indexing with powerful regex-based searching.",
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
							Setup in 30 seconds
						</h2>
						<div className="space-y-8">
							{[
								{
									n: 1,
									title: "Create an account",
									desc: "Sign up for our free tier and get your instance key.",
								},
								{
									n: 2,
									title: "Install the Agent",
									desc: "One command deployment across your entire fleet.",
								},
								{
									n: 3,
									title: "Visualize Everything",
									desc: "Your dashboard starts populating metrics instantly.",
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
							NanoNet AI Engine
						</span>
					</div>
					<h2 className="text-5xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter leading-tight">
						Root Cause Analysis in <br />
						<span className="text-indigo-600">Seconds</span>, Not Hours.
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
										Anomaly Detected
									</span>
									<div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
									<span className="text-xs font-mono text-slate-500">
										12:44:02 UTC
									</span>
								</div>
								<h4 className="text-xl font-bold">
									Unexpected traffic spike in 'Auth-v2' service
								</h4>
								<div className="flex items-center gap-4 py-4">
									<div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3 rounded-lg flex-1 flex items-center gap-3">
										<ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
										<p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
											AI Insight: Spike correlated with{" "}
											<span className="text-indigo-600 font-bold">
												Deployment #882
											</span>
											. Database connection pool exhaustion likely.
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
								Built for Developers
							</h2>
							<p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
								Our agent is a single, static binary that consumes less than 1%
								CPU. No complex sidecars, no bloated dependencies.
							</p>
							<ul className="space-y-5">
								{[
									"eBPF-powered instrumentation",
									"OpenTelemetry native export",
									"Automatic service tagging",
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
								<p className="text-slate-500"># Fast installation script</p>
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
										&gt;&gt; Authenticating node...
									</p>
									<p className="text-slate-500">
										&gt;&gt; Installing binaries...
									</p>
									<p className="text-cyan-500 font-bold">
										&gt;&gt; SUCCESS: NanoNet Agent is active.
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
							NanoNet v2.0 · The grid never rests
						</span>
					</div>
					<div className="flex flex-wrap justify-center gap-8">
						{["Privacy", "Terms", "Security", "Status"].map((item) => (
							<a
								key={item}
								className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors"
								href="/"
							>
								{item}
							</a>
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
