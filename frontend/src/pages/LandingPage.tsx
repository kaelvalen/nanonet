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
	Terminal,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import logo from "@/assets/logo.png";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens used on this page. Landing is self-contained dark — no theme
// dependency so it's consistent whether signed in or not.
const INK = "#060810";
const INK_ELEVATED = "#0d1117";
const TEAL = "#2dd4bf";
const ACCENT_LINE = "rgba(45, 212, 191, 0.4)";

// ─────────────────────────────────────────────────────────────────────────────
// Nav

function Nav({ authed }: { authed: boolean }) {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
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
			className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
				scrolled
					? "bg-[#060810]/80 backdrop-blur-xl border-b border-white/5"
					: "bg-transparent"
			}`}
		>
			<nav className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
				<Link to="/" className="flex items-center gap-2.5">
					<img src={logo} alt="NanoNet" className="w-6 h-6" />
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
							className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors rounded-md"
						>
							{l.label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-2">
					{authed ? (
						<Link
							to="/app"
							className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white text-slate-900 text-[13px] font-semibold hover:bg-white/90 transition-colors"
						>
							Uygulamaya git
							<ArrowRight className="w-3.5 h-3.5" />
						</Link>
					) : (
						<>
							<Link
								to="/login"
								className="h-8 px-3 flex items-center text-[13px] text-white/70 hover:text-white transition-colors rounded-md"
							>
								Giriş
							</Link>
							<Link
								to="/register"
								className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white text-slate-900 text-[13px] font-semibold hover:bg-white/90 transition-colors"
							>
								Başla
								<ArrowRight className="w-3.5 h-3.5" />
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
	return (
		<section
			className="relative pt-32 pb-24 overflow-hidden"
			style={{ background: INK }}
		>
			{/* Grid texture */}
			<div
				className="absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
					backgroundSize: "64px 64px",
				}}
			/>

			{/* Top accent line */}
			<div
				className="absolute top-14 inset-x-0 h-px"
				style={{
					background: `linear-gradient(90deg, transparent, ${ACCENT_LINE}, transparent)`,
				}}
			/>

			<div className="relative max-w-5xl mx-auto px-6 text-center">
				{/* Badge */}
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/5 border border-white/10 mb-8"
				>
					<span className="relative flex w-1.5 h-1.5">
						<span
							className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-75"
							style={{ background: TEAL }}
						/>
						<span
							className="relative inline-flex w-1.5 h-1.5 rounded-full"
							style={{ background: TEAL }}
						/>
					</span>
					<span className="text-[11px] font-medium text-white/70">
						{authed && liveCount > 0
							? `${liveCount} servis canlı izleniyor`
							: "Self-hosted · Açık kaynak"}
					</span>
				</motion.div>

				{/* Title */}
				<motion.h1
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.02] mb-6"
				>
					Mikroservislerinizi
					<br />
					<span
						className="inline-block"
						style={{
							background: `linear-gradient(135deg, #f0fdfa 0%, ${TEAL} 100%)`,
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						sessizce izleyin
					</span>
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.1 }}
					className="text-base md:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10"
				>
					Gerçek zamanlı metrik, uyarı ve AI destekli kök-neden analizi.
					Kendi altyapınızda çalışır, verileriniz hep sizde kalır.
				</motion.p>

				{/* CTAs */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.2 }}
					className="flex items-center justify-center gap-3 flex-wrap mb-16"
				>
					<Link
						to={authed ? "/app" : "/register"}
						className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-[14px] font-semibold text-slate-900 bg-white hover:bg-white/95 transition-colors"
					>
						{authed ? "Uygulamaya git" : "Ücretsiz başla"}
						<ArrowRight className="w-4 h-4" />
					</Link>
					<button
						type="button"
						onClick={() =>
							document
								.getElementById("how")
								?.scrollIntoView({ behavior: "smooth" })
						}
						className="inline-flex items-center gap-2 h-11 px-5 rounded-lg text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
					>
						Nasıl çalışır
						<ChevronRight className="w-4 h-4" />
					</button>
				</motion.div>

				{/* Product mock */}
				<motion.div
					initial={{ opacity: 0, y: 32 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.3 }}
					className="relative"
				>
					<div
						className="absolute inset-x-0 -top-8 h-24 blur-3xl opacity-40"
						style={{
							background: `radial-gradient(ellipse at center, ${TEAL}30, transparent 70%)`,
						}}
					/>
					<ProductMock />
				</motion.div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Product mock (browser chrome + mini dashboard preview)

function ProductMock() {
	return (
		<div
			className="relative mx-auto max-w-4xl rounded-xl overflow-hidden border border-white/10"
			style={{
				background: INK_ELEVATED,
				boxShadow: "0 32px 64px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
			}}
		>
			{/* Chrome */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
				<div className="flex items-center gap-1.5">
					<span className="w-2.5 h-2.5 rounded-full bg-white/10" />
					<span className="w-2.5 h-2.5 rounded-full bg-white/10" />
					<span className="w-2.5 h-2.5 rounded-full bg-white/10" />
				</div>
				<div className="mx-3 flex-1 h-6 rounded-md bg-white/[0.03] border border-white/5 flex items-center justify-center">
					<span className="text-[10px] font-mono text-white/30 tracking-wider">
						console.nanonet.dev / dashboard
					</span>
				</div>
			</div>

			{/* Content */}
			<div className="p-6 grid grid-cols-3 gap-4">
				<MockTile label="Toplam servis" value="28" accent="teal" />
				<MockTile label="Ortalama latency" value="42 ms" accent="amber" />
				<MockTile label="Aktif uyarı" value="2" accent="rose" />

				<div className="col-span-3 rounded-lg border border-white/5 bg-white/[0.02] p-4">
					<div className="flex items-center justify-between mb-4">
						<span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
							Son 24 saat · Latency (p50)
						</span>
						<span className="text-[10px] font-mono text-white/30">
							canlı
						</span>
					</div>
					<MockSparkGraph />
				</div>

				<div className="col-span-3 grid grid-cols-3 gap-3">
					{[
						{ name: "api-gateway", status: "up", latency: "12 ms" },
						{ name: "auth-service", status: "up", latency: "8 ms" },
						{ name: "metrics-engine", status: "warn", latency: "340 ms" },
					].map((svc) => (
						<div
							key={svc.name}
							className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 flex items-center gap-2"
						>
							<span
								className="w-1.5 h-1.5 rounded-full shrink-0"
								style={{
									background:
										svc.status === "up"
											? "#34d399"
											: svc.status === "warn"
												? "#fbbf24"
												: "#fb7185",
								}}
							/>
							<span className="text-xs font-mono text-white/70 flex-1 truncate">
								{svc.name}
							</span>
							<span className="text-[10px] font-mono text-white/40 tabular-nums">
								{svc.latency}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function MockTile({
	label,
	value,
	accent,
}: {
	label: string;
	value: string;
	accent: "teal" | "amber" | "rose";
}) {
	const color =
		accent === "teal"
			? "#2dd4bf"
			: accent === "amber"
				? "#fbbf24"
				: "#fb7185";
	return (
		<div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 relative overflow-hidden">
			<div
				className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
				style={{ background: color }}
			/>
			<p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
				{label}
			</p>
			<p className="text-2xl font-mono font-semibold tabular-nums text-white leading-none">
				{value}
			</p>
		</div>
	);
}

function MockSparkGraph() {
	// Static deterministic values — no fake randomness
	const values = [24, 28, 26, 32, 30, 42, 38, 46, 42, 38, 36, 44];
	const max = Math.max(...values);
	const min = Math.min(...values);
	const range = max - min || 1;

	return (
		<svg viewBox="0 0 240 60" className="w-full h-16" preserveAspectRatio="none">
			<defs>
				<linearGradient id="mock-area" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={TEAL} stopOpacity="0.25" />
					<stop offset="100%" stopColor={TEAL} stopOpacity="0" />
				</linearGradient>
			</defs>
			<polyline
				fill="none"
				stroke={TEAL}
				strokeWidth="1.5"
				points={values
					.map((v, i) => `${(i / (values.length - 1)) * 240},${60 - ((v - min) / range) * 50 - 5}`)
					.join(" ")}
			/>
			<polygon
				fill="url(#mock-area)"
				points={`0,60 ${values
					.map((v, i) => `${(i / (values.length - 1)) * 240},${60 - ((v - min) / range) * 50 - 5}`)
					.join(" ")} 240,60`}
			/>
		</svg>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Features

const FEATURES: {
	icon: typeof Activity;
	title: string;
	desc: string;
}[] = [
	{
		icon: Activity,
		title: "Gerçek zamanlı sağlık",
		desc: "Her servisin CPU, bellek, latency ve hata oranı 5 saniyede bir güncellenir.",
	},
	{
		icon: Brain,
		title: "AI kök-neden analizi",
		desc: "Uyarı tetiklendiğinde olası nedenleri, etkilenen bileşenleri ve öneriyi tek tıkla al.",
	},
	{
		icon: GitBranch,
		title: "Bağımlılık haritası",
		desc: "Servisler arası ilişkileri görselleştir, nokta arızaların domino etkisini önle.",
	},
	{
		icon: Cloud,
		title: "Kubernetes entegrasyonu",
		desc: "Pod metrikleri, deployment durumu ve event stream aynı panelde.",
	},
	{
		icon: Bell,
		title: "Akıllı uyarılar",
		desc: "Flapping kontrolü, snooze, slack/webhook entegrasyonu. Gürültü yok, sinyal var.",
	},
	{
		icon: Terminal,
		title: "Yapılandırılmış loglar",
		desc: "Tüm servislerden log toplama, severity filtresi, tam metin arama.",
	},
];

function Features() {
	return (
		<section id="features" className="py-28 px-6" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
					className="max-w-2xl mb-16"
				>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400 mb-3">
						Her şey dahil
					</p>
					<h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
						Tek platform,
						<span className="text-white/40"> altı kritik yetenek.</span>
					</h2>
				</motion.div>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden">
					{FEATURES.map((f) => (
						<div
							key={f.title}
							className="relative p-7 group transition-colors"
							style={{ background: INK }}
						>
							<div
								className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
								style={{
									background:
										"radial-gradient(400px circle at 50% 0%, rgba(45,212,191,0.05), transparent 70%)",
								}}
							/>
							<div className="relative">
								<div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5 group-hover:border-teal-500/30 transition-colors">
									<f.icon className="w-4.5 h-4.5 text-white/60 group-hover:text-teal-400 transition-colors" />
								</div>
								<h3 className="text-[15px] font-semibold text-white mb-2 tracking-tight">
									{f.title}
								</h3>
								<p className="text-[13px] text-white/45 leading-relaxed">
									{f.desc}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works

function HowItWorks() {
	const steps = [
		{
			n: "01",
			icon: Box,
			title: "Servisi kaydedin",
			desc: "Dashboard'dan host, port ve health endpoint'ini girin. 30 saniyede tamam.",
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
			desc: "Metrikler canlı akmaya başlar. AI uyarıların nedenini açıklar, harita bağımlılıkları gösterir.",
		},
	];

	return (
		<section id="how" className="py-28 px-6" style={{ background: INK_ELEVATED }}>
			<div className="max-w-6xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
					className="max-w-2xl mb-16"
				>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400 mb-3">
						Nasıl çalışır
					</p>
					<h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
						Üç adımda canlı.
						<span className="text-white/40"> Karmaşa yok.</span>
					</h2>
				</motion.div>

				<div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden">
					{steps.map((s) => (
						<div
							key={s.n}
							className="p-8 relative"
							style={{ background: INK_ELEVATED }}
						>
							<div className="flex items-baseline gap-3 mb-5">
								<span className="text-[10px] font-mono font-semibold text-teal-400 tracking-[0.2em]">
									{s.n}
								</span>
								<span className="flex-1 h-px bg-white/5" />
								<s.icon className="w-4 h-4 text-white/30" />
							</div>
							<h3 className="text-lg font-semibold text-white mb-3 tracking-tight">
								{s.title}
							</h3>
							<p className="text-sm text-white/45 leading-relaxed">
								{s.desc}
							</p>
						</div>
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
		<section id="ai" className="py-28 px-6" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
				>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400 mb-3">
						AI kök-neden
					</p>
					<h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight mb-5">
						Sadece
						<span className="text-white/40"> "servis down"</span> demiyoruz.
					</h2>
					<p className="text-base text-white/50 leading-relaxed mb-8">
						Claude destekli analiz motoru; metrik, log ve alert geçmişini
						birleştirip olası kök-nedeni, etkilenen bileşenleri ve çözüm
						önerisini çıkarır.
					</p>
					<ul className="space-y-3">
						{[
							"Metrik anomalisi + log pattern korelasyonu",
							"Etkilenen servis ağı görselleştirmesi",
							"Deployment penceresi ile olay eşleştirme",
						].map((item) => (
							<li key={item} className="flex items-start gap-3">
								<CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
								<span className="text-sm text-white/70">{item}</span>
							</li>
						))}
					</ul>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, scale: 0.96 }}
					whileInView={{ opacity: 1, scale: 1 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
				>
					<AIExampleCard />
				</motion.div>
			</div>
		</section>
	);
}

function AIExampleCard() {
	return (
		<div
			className="rounded-xl overflow-hidden border border-white/10"
			style={{
				background: INK_ELEVATED,
				boxShadow: "0 24px 48px -12px rgba(0,0,0,0.4)",
			}}
		>
			{/* Header */}
			<div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/5">
				<Brain className="w-3.5 h-3.5 text-teal-400" />
				<span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
					AI analizi
				</span>
				<div className="flex-1" />
				<span className="text-[10px] font-mono text-white/30">2s önce</span>
			</div>

			{/* Alert row */}
			<div className="px-5 py-4 border-b border-white/5">
				<div className="flex items-center gap-2 mb-2">
					<span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
					<span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
						Kritik
					</span>
					<span className="text-xs font-mono text-white/40 ml-auto">
						payments-api · 12:44 UTC
					</span>
				</div>
				<p className="text-[14px] text-white font-medium">
					p95 latency 1.2s'ye yükseldi, hata oranı %8
				</p>
			</div>

			{/* Analysis */}
			<div className="px-5 py-4 space-y-3">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
						Olası kök-neden
					</p>
					<p className="text-[13px] text-white/80 leading-relaxed">
						Son deployment'ta değişen SQL sorgusu yeni bir index kullanıyor
						gibi görünüyor. <code className="text-teal-400 text-xs bg-white/5 px-1 py-0.5 rounded">payments_by_user</code>{" "}
						index'i RDS'te yok.
					</p>
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
						Öneri
					</p>
					<div className="flex items-start gap-2 bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-2.5">
						<ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
						<code className="text-[12px] text-white/80 font-mono flex-1 leading-relaxed">
							CREATE INDEX CONCURRENTLY payments_by_user ON payments(user_id);
						</code>
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
		<section id="devs" className="py-28 px-6" style={{ background: INK_ELEVATED }}>
			<div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
				>
					<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400 mb-3">
						Geliştiriciler için
					</p>
					<h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight mb-5">
						Tek script,
						<span className="text-white/40"> sıfır sürpriz.</span>
					</h2>
					<p className="text-base text-white/50 leading-relaxed mb-8">
						Rust ile yazılmış tek binary agent. Docker değil, daemon değil,
						çok hafif. Alt yapınıza girmeden önce kaynak kodunu inceleyin.
					</p>
					<div className="grid grid-cols-3 gap-4">
						{[
							{ label: "Binary", value: "6 MB" },
							{ label: "RAM (avg)", value: "18 MB" },
							{ label: "Poll", value: "5s" },
						].map((m) => (
							<div
								key={m.label}
								className="p-3 rounded-lg border border-white/5 bg-white/[0.02]"
							>
								<p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
									{m.label}
								</p>
								<p className="text-xl font-mono font-semibold text-white mt-1 tabular-nums">
									{m.value}
								</p>
							</div>
						))}
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6 }}
					className="rounded-xl overflow-hidden border border-white/10"
					style={{ background: "#050810" }}
				>
					<div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
						<div className="w-2.5 h-2.5 rounded-full bg-rose-500/30" />
						<div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
						<div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
						<span className="ml-auto text-[10px] font-mono text-white/20 tracking-wider">
							bash
						</span>
					</div>
					<pre className="p-5 font-mono text-[12px] leading-relaxed text-white/70 overflow-x-auto">
						<code>
							<span className="text-white/30"># Agent kurulumu</span>
							{"\n"}
							<span className="text-teal-400">$</span> ./agent-setup.sh{" "}
							<span className="text-white/50">\</span>
							{"\n"}    <span className="text-white/50">--backend</span> https://api.nanonet.dev{" "}
							<span className="text-white/50">\</span>
							{"\n"}    <span className="text-white/50">--token</span> $NANONET_TOKEN
							{"\n\n"}
							<span className="text-white/40">→ Servis eşleniyor...</span>
							{"\n"}
							<span className="text-white/40">→ Binary doğrulanıyor (6.2 MB)</span>
							{"\n"}
							<span className="text-white/40">→ systemd unit kuruldu</span>
							{"\n"}
							<span className="text-emerald-400">✓ nanonet-agent aktif · PID 12847</span>
						</code>
					</pre>
				</motion.div>
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats strip

function StatsStrip() {
	const stats = [
		{ icon: Cpu, label: "Agent overhead", value: "<1% CPU" },
		{ icon: Shield, label: "Veri aktarımı", value: "TLS + mTLS" },
		{ icon: Activity, label: "Poll interval", value: "5-300s" },
		{ icon: Zap, label: "Alert SLA", value: "<10s" },
	];
	return (
		<section className="py-16 px-6 border-y border-white/5" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden">
				{stats.map((s) => (
					<div
						key={s.label}
						className="p-6 flex items-center gap-4"
						style={{ background: INK }}
					>
						<s.icon className="w-5 h-5 text-teal-400 shrink-0" />
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
								{s.label}
							</p>
							<p className="text-base font-mono font-semibold text-white mt-0.5 tabular-nums">
								{s.value}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA + Footer

function CTA({ authed }: { authed: boolean }) {
	return (
		<section className="py-32 px-6 relative overflow-hidden" style={{ background: INK }}>
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse at center, rgba(45,212,191,0.06), transparent 60%)",
				}}
			/>
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="relative max-w-3xl mx-auto text-center"
			>
				<h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
					Bugün kurun,
					<br />
					<span className="text-white/40">yarın şüphe içinde olmayın.</span>
				</h2>
				<p className="text-base text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
					Self-hosted, açık kaynak. İlk servisi dakikalar içinde bağlayın.
				</p>
				<div className="flex items-center justify-center gap-3 flex-wrap">
					<Link
						to={authed ? "/app" : "/register"}
						className="inline-flex items-center gap-2 h-11 px-7 rounded-lg text-[14px] font-semibold text-slate-900 bg-white hover:bg-white/95 transition-colors"
					>
						{authed ? "Dashboard'a git" : "Ücretsiz başla"}
						<ArrowRight className="w-4 h-4" />
					</Link>
					{!authed && (
						<Link
							to="/login"
							className="inline-flex items-center gap-2 h-11 px-5 rounded-lg text-[14px] font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
						>
							Giriş yap
						</Link>
					)}
				</div>
			</motion.div>
		</section>
	);
}

function Footer() {
	return (
		<footer className="border-t border-white/5 py-10 px-6" style={{ background: INK }}>
			<div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
				<div className="flex items-center gap-2.5">
					<img src={logo} alt="NanoNet" className="w-5 h-5 opacity-60" />
					<span className="text-sm font-semibold text-white/60">NanoNet</span>
					<span className="text-xs text-white/30 font-mono">v2.0</span>
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
							className="text-xs text-white/40 hover:text-white/80 transition-colors"
						>
							{l.label}
						</Link>
					))}
				</div>
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
