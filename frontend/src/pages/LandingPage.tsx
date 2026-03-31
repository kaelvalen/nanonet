import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	Bot,
	Brain,
	Copy,
	Cpu,
	Database,
	EyeOff,
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
import { Button } from "@/components/ui/button";
import landingVideo from "@/assets/video/landing.mp4";
import logo from "@/assets/logo.png";

const headline: React.CSSProperties = {
	fontFamily: "'Space Grotesk', system-ui, sans-serif",
};

const features = [
	{
		icon: Activity,
		title: "Health Monitoring",
		desc: "Continuous telemetry aggregation from edge to core with sub-millisecond resolution.",
		accent: "var(--primary)",
	},
	{
		icon: Brain,
		title: "AI Anomaly Detection",
		desc: "Neural network baseline learning that distinguishes between noise and critical system shifts.",
		accent: "var(--brand-secondary)",
	},
	{
		icon: GitFork,
		title: "Service Dependency Map",
		desc: "Real-time graph visualization of every microservice interaction and bottleneck.",
		accent: "var(--primary)",
	},
	{
		icon: LayoutGrid,
		title: "Kubernetes Integration",
		desc: "Native sidecar injection and cluster-level observability out of the box.",
		accent: "var(--brand-secondary)",
	},
	{
		icon: Bell,
		title: "Real-time Alerts",
		desc: "Configurable surgical triggers that ping Slack, PagerDuty, or Webhooks instantly.",
		accent: "var(--primary)",
	},
	{
		icon: Terminal,
		title: "Log Viewer",
		desc: "High-throughput log tailing with structured search and regex-based filtering.",
		accent: "var(--brand-secondary)",
	},
];

const steps = [
	{
		n: "01",
		title: "Provision Environment",
		desc: "Select your cloud provider or on-prem cluster for the NanoNet connector.",
	},
	{
		n: "02",
		title: "Inject Sidecar",
		desc: "Run the one-line installer to deploy lightweight eBPF-based monitoring agents.",
	},
	{
		n: "03",
		title: "Analyze Data",
		desc: "Watch as the dependency map populates and anomalies are auto-detected.",
	},
];

export function LandingPage() {
	return (
		<div
			className="min-h-screen"
			style={{ background: "var(--background)", color: "var(--foreground)" }}
		>
			{/* Navbar */}
			<nav
				className="fixed top-0 w-full z-50 border-b"
				style={{
					background: "rgba(248,250,252,0.85)",
					backdropFilter: "blur(16px)",
					borderColor: "var(--border-default)",
					boxShadow: "0 4px 24px rgba(79,70,229,0.06)",
				}}
			>
				<div className="flex justify-between items-center max-w-[1440px] mx-auto px-10 py-4">
					<div className="flex items-center gap-2.5">
						<img src={logo} alt="NanoNet" className="w-12 h-12 object-contain" />
						<span
							className="text-2xl font-bold tracking-tighter"
							style={{ ...headline, color: "var(--primary)" }}
						>
							NanoNet
						</span>
					</div>
					<div className="hidden md:flex gap-10">
						{["Platform", "Observability", "Solutions", "Developers", "Pricing"].map(
							(item, i) => (
								<a
									key={item}
									href="#"
									className="text-sm font-medium transition-colors"
									style={{
										...headline,
										color: i === 0 ? "var(--primary)" : "var(--text-muted)",
										borderBottom: i === 0 ? "2px solid var(--primary)" : "none",
									}}
								>
									{item}
								</a>
							),
						)}
					</div>
					<Link to="/login">
						<Button
							style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" }}
						>
							Get Started
						</Button>
					</Link>
				</div>
			</nav>

			{/* Hero */}
			<header className="pt-40 pb-24 px-10 max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
				<motion.div
					initial={{ opacity: 0, y: 32 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, type: "spring", stiffness: 180, damping: 22 }}
					className="space-y-8"
				>
					<div
						className="inline-block px-3 py-1 rounded-sm"
						style={{
							background: "color-mix(in srgb, var(--brand-secondary) 15%, transparent)",
							color: "var(--brand-secondary-hover)",
						}}
					>
						<span className="text-[0.6875rem] font-bold tracking-widest uppercase" style={headline}>
							System Protocol v2.0
						</span>
					</div>

					<h1
						className="text-[4.5rem] leading-[0.9] font-bold tracking-tighter"
						style={{ ...headline, color: "var(--foreground)" }}
					>
						See the noise.
						<br />
						<span style={{ color: "var(--brand-secondary)" }}>Find the signal.</span>
					</h1>

					<p className="text-xl max-w-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
						NanoNet provides surgical precision for distributed systems. Identify
						micro-latency spikes and ghost outages before your users do.
					</p>

					<div className="flex gap-4 pt-4">
						<Link to="/login">
							<Button
								size="lg"
								className="font-bold text-base px-8 py-4 shadow-lg"
								style={{
									...headline,
									background: "linear-gradient(135deg, var(--brand-secondary) 0%, var(--primary) 100%)",
									color: "white",
								}}
							>
								Start Demo
							</Button>
						</Link>
						<Button
							size="lg"
							variant="outline"
							className="font-bold text-base px-8 py-4"
							style={{
								...headline,
								borderColor: "var(--border-default)",
								color: "var(--primary)",
							}}
							onClick={() =>
								window.open("https://github.com/kaelvalen/nanonet", "_blank")
							}
						>
							GitHub
						</Button>
					</div>
				</motion.div>

				{/* Mock Node Map */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: 0.2, duration: 0.6 }}
					className="relative h-[460px] rounded-xl overflow-hidden"
					style={{
						background: "var(--surface-sunken)",
						boxShadow: "0 12px 32px rgba(79,70,229,0.08)",
					}}
				>
					<div className="absolute inset-0 p-12 grid grid-cols-3 grid-rows-3 gap-6 opacity-90">
						<NodeCard col="col-start-1" row="row-start-2" icon={<Network className="w-4 h-4" />} label="API_GATEWAY" accent="var(--primary)" />
						<NodeCard col="col-start-2" row="row-start-1" icon={<Database className="w-4 h-4" />} label="AUTH_DB" accent="var(--brand-secondary)" />
						<NodeCard col="col-start-2" row="row-start-3" icon={<Cpu className="w-4 h-4" />} label="CACHE_LAYER" accent="var(--primary)" />
						<NodeCard col="col-start-3" row="row-start-2" icon={<AlertTriangle className="w-4 h-4" />} label="CHECKOUT_SVC" accent="var(--destructive)" />
					</div>
				</motion.div>
			</header>

			{/* Problem Bar */}
			<section style={{ background: "var(--surface-sunken)" }} className="py-12">
				<div className="max-w-[1440px] mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-8">
					<p className="font-bold text-xl" style={{ ...headline, color: "var(--text-muted)" }}>
						Are you learning about outages from your end-users?
					</p>
					<div className="flex gap-12">
						{[
							{ icon: <Gauge className="w-5 h-5" />, label: "Latency Spikes" },
							{ icon: <TrendingDown className="w-5 h-5" />, label: "Data Drift" },
							{ icon: <EyeOff className="w-5 h-5" />, label: "Ghost Outages" },
						].map(({ icon, label }) => (
							<div
								key={label}
								className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-all"
							>
								<span style={{ color: "var(--primary)" }}>{icon}</span>
								<span className="text-sm font-bold tracking-tight" style={headline}>
									{label}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Feature Grid */}
			<section className="py-32 px-10 max-w-[1440px] mx-auto">
				<div className="flex items-baseline gap-4 mb-16">
					<h2 className="text-4xl font-bold" style={headline}>
						Clinical Suite
					</h2>
					<div className="h-[2px] flex-grow" style={{ background: "var(--border-default)" }} />
					<span
						className="text-sm font-bold"
						style={{ ...headline, color: "var(--primary)" }}
					>
						06 CORE MODULES
					</span>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{features.map((f, i) => (
						<motion.div
							key={f.title}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: i * 0.07, duration: 0.4 }}
							className="relative rounded-lg p-8 overflow-hidden hover:-translate-y-1 transition-transform"
							style={{
								background: "var(--surface-raised)",
								boxShadow: "0 4px 24px rgba(79,70,229,0.06)",
							}}
						>
							{/* Left accent nerve */}
							<div
								className="absolute left-0 top-0 w-[3px] h-full"
								style={{ background: f.accent }}
							/>
							<div
								className="mb-6 w-12 h-12 rounded flex items-center justify-center"
								style={{
									background: `color-mix(in srgb, ${f.accent} 12%, transparent)`,
									color: f.accent,
								}}
							>
								<f.icon className="w-5 h-5" />
							</div>
							<h3 className="font-bold text-xl mb-3" style={headline}>
								{f.title}
							</h3>
							<p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
								{f.desc}
							</p>
						</motion.div>
					))}
				</div>
			</section>

			{/* Install Strip */}
			<section className="py-24 text-white overflow-hidden" style={{ background: "#0f172a" }}>
				<div className="max-w-[1440px] mx-auto px-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
					<div className="space-y-12">
						<h2 className="text-4xl font-bold" style={headline}>
							Install Agent in 30 seconds
						</h2>
						<div className="space-y-8">
							{steps.map((s) => (
								<div key={s.n} className="flex gap-6 items-start">
									<span
										className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-sm"
										style={{
											border: "1px solid rgba(6,182,212,0.3)",
											color: "var(--brand-secondary)",
										}}
									>
										{s.n}
									</span>
									<div>
										<h4 className="font-bold text-lg mb-1" style={headline}>
											{s.title}
										</h4>
										<p className="text-slate-400">{s.desc}</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Video preview */}
					<div className="relative group">
						<div
							className="absolute -inset-1 rounded-xl opacity-50 group-hover:opacity-100 transition duration-1000 blur-2xl"
							style={{ background: "rgba(6,182,212,0.2)" }}
						/>
						<div
							className="relative rounded-xl overflow-hidden"
							style={{ background: "#1e293b", border: "1px solid #334155" }}
						>
							<video
								src={landingVideo}
								autoPlay
								muted
								loop
								playsInline
								className="w-full rounded-xl"
								style={{ display: "block" }}
							/>
						</div>
					</div>
				</div>
			</section>

			{/* AI Insight Spotlight */}
			<section className="py-32 px-10 max-w-[1440px] mx-auto">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
					{/* Circular diagram */}
					<div className="relative flex items-center justify-center h-[420px]">
						<div
							className="w-[360px] h-[360px] rounded-full flex items-center justify-center"
							style={{ border: "1px solid var(--border-default)" }}
						>
							<div
								className="w-[280px] h-[280px] rounded-full flex items-center justify-center"
								style={{ border: "1px solid var(--border-default)" }}
							>
								<motion.div
									animate={{ boxShadow: ["0 0 24px rgba(239,68,68,0.3)", "0 0 48px rgba(239,68,68,0.6)", "0 0 24px rgba(239,68,68,0.3)"] }}
									transition={{ duration: 2, repeat: Infinity }}
									className="relative w-16 h-16 rounded-full flex items-center justify-center"
									style={{ background: "var(--destructive)" }}
								>
									<Zap className="w-7 h-7 text-white" />

									{/* Floating alert card */}
									<div
										className="absolute left-full ml-8 w-64 p-4 rounded-lg border-l-4 z-10"
										style={{
											background: "var(--surface-raised)",
											borderLeftColor: "var(--destructive)",
											boxShadow: "0 8px 24px rgba(239,68,68,0.12)",
										}}
									>
										<span
											className="block text-[10px] font-bold tracking-widest uppercase mb-2"
											style={{ color: "var(--destructive)" }}
										>
											CRITICAL SYSTEM EVENT
										</span>
										<p className="font-bold text-sm mb-1" style={{ color: "var(--foreground)" }}>
											Anomaly Detected
										</p>
										<p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
											Root cause: Latency spike in Service B via neural baseline drift.
										</p>
									</div>
								</motion.div>
							</div>
						</div>
					</div>

					<div className="space-y-8">
						<Bot className="w-14 h-14" style={{ color: "var(--brand-secondary)" }} />
						<h2
							className="text-5xl font-bold leading-tight"
							style={headline}
						>
							Zero-Config
							<br />
							<span style={{ color: "var(--primary)" }}>Intelligence</span>
						</h2>
						<p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
							Our proprietary AI doesn't wait for thresholds. It learns the "heartbeat" of
							your architecture. When a node turns red, NanoNet has already traced the
							lineage back to the offending deployment, configuration change, or underlying
							infrastructure failure.
						</p>
						<Link
							to="/app/ai-insights"
							className="inline-flex items-center gap-2 font-bold transition-all hover:gap-4"
							style={{ ...headline, color: "var(--primary)" }}
						>
							EXPLORE THE AI ENGINE <ArrowRight className="w-4 h-4" />
						</Link>
					</div>
				</div>
			</section>

			{/* Terminal CTA */}
			<section className="pb-32 px-10 max-w-[1440px] mx-auto">
				<div className="rounded-xl p-10 relative overflow-hidden" style={{ background: "#020617" }}>
					<div
						className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
						style={{
							background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
						}}
					/>
					<div className="relative z-10">
						<div className="flex gap-2 mb-8">
							{[0, 1, 2].map((i) => (
								<div key={i} className="w-3 h-3 rounded-full" style={{ background: "#1e293b" }} />
							))}
						</div>
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
							<div>
								<h3 className="text-white text-3xl font-bold mb-4" style={headline}>
									Initialize the Nerve Center
								</h3>
								<p className="text-slate-400 max-w-md">
									Deploy the global controller to your management cluster with a single
									authenticated command.
								</p>
							</div>
							<div
								className="p-6 rounded-md font-mono text-sm flex items-center gap-4"
								style={{ background: "#0f172a", border: "1px solid #1e293b" }}
							>
								<span style={{ color: "var(--brand-secondary)" }}>$</span>
								<code className="text-slate-200">
									curl -sSL https://get.nanonet.dev | bash
								</code>
								<button
									className="ml-4 text-slate-500 hover:text-white transition-colors"
									onClick={() =>
										navigator.clipboard.writeText(
											"curl -sSL https://get.nanonet.dev | bash",
										)
									}
									title="Copy"
								>
									<Copy className="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer
				className="border-t"
				style={{ background: "#f8fafc", borderColor: "var(--border-subtle)" }}
			>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 max-w-[1440px] mx-auto px-10 py-16 text-sm">
					<div className="space-y-6">
						<span className="text-xl font-black" style={{ color: "var(--foreground)" }}>
							NanoNet
						</span>
						<p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>
							Precision monitoring for systems that cannot fail. Built for the modern
							distributed enterprise.
						</p>
						<p className="font-bold tracking-tight" style={{ ...headline, color: "var(--primary)" }}>
							NanoNet v2.0 · The grid never rests
						</p>
					</div>
					{[
						{
							heading: "Product",
							links: ["Network Map", "AI Insights", "Cloud Native", "Pricing"],
						},
						{
							heading: "Resources",
							links: ["Documentation", "API Reference", "Community", "Security"],
						},
						{
							heading: "Company",
							links: ["About Us", "Privacy Policy", "Terms of Service", "Contact"],
						},
					].map((col) => (
						<div key={col.heading}>
							<h4
								className="font-bold mb-6 uppercase tracking-widest text-[10px]"
								style={{ color: "var(--foreground)" }}
							>
								{col.heading}
							</h4>
							<ul className="space-y-4" style={{ color: "var(--text-muted)" }}>
								{col.links.map((link) => (
									<li key={link}>
										<a
											href="#"
											className="hover:underline transition-opacity"
											style={{ color: "var(--text-muted)" }}
										>
											{link}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div
					className="max-w-[1440px] mx-auto px-10 py-8 border-t flex justify-between items-center text-[10px] uppercase tracking-widest font-bold"
					style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
				>
					<span>© 2024 NanoNet Systems. All rights reserved.</span>
					<div className="flex gap-6">
						<span>
							System Status:{" "}
							<span style={{ color: "var(--brand-secondary)" }}>Nominal</span>
						</span>
						<span>
							Region: <span style={{ color: "var(--foreground)" }}>Global</span>
						</span>
					</div>
				</div>
			</footer>
		</div>
	);
}

function NodeCard({
	col,
	row,
	icon,
	label,
	accent,
}: {
	col: string;
	row: string;
	icon: React.ReactNode;
	label: string;
	accent: string;
}) {
	return (
		<div
			className={`${col} ${row} bg-white p-4 rounded flex items-center gap-3`}
			style={{
				borderLeft: `4px solid ${accent}`,
				boxShadow: "0 4px 12px rgba(79,70,229,0.08)",
			}}
		>
			<span style={{ color: accent }}>{icon}</span>
			<span className="text-xs font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
				{label}
			</span>
		</div>
	);
}
