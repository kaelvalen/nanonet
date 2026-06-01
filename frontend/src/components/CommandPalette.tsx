import {
	Activity,
	AlertCircle,
	ArrowRight,
	Cloud,
	CornerDownLeft,
	GitCompare,
	Home,
	Play,
	Plus,
	Power,
	RefreshCw,
	RotateCw,
	Search,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { servicesApi } from "@/api/services";
import { MOD_KEY } from "@/lib/platform";
import { preloadRoute } from "@/routes";
import { useAIAssistantStore } from "@/store/aiAssistantStore";
import { useServiceStore } from "@/store/serviceStore";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "./ui/command";

/* CommandPalette — single keyboard surface for: navigation, services, AI ask,
   and slash-commands. The mode is derived from the input prefix:

       (none)  — fuzzy search across nav + services + actions
       /       — slash command (e.g. `/restart api-gateway`)
       ?       — AI ask mode (free-form question to assistant)
       >       — context actions for the currently active page

   Mode switching is symmetric — backspace past the prefix returns to the
   default mode. Empty palette also defaults to the search mode. */

type Mode = "search" | "slash" | "ask" | "context";

interface NavLinkItem {
	label: string;
	icon: React.ElementType;
	path: string;
	shortcut?: string;
}

const NAV_ITEMS: NavLinkItem[] = [
	{ label: "Genel Bakış", icon: Home, path: "/app", shortcut: "G D" },
	{ label: "Servisler", icon: Server, path: "/app/services", shortcut: "G S" },
	{
		label: "Uyarılar",
		icon: AlertCircle,
		path: "/app/alerts",
		shortcut: "G A",
	},
	{
		label: "AI İçgörüler",
		icon: Sparkles,
		path: "/app/ai-insights",
		shortcut: "G I",
	},
	{
		label: "Kubernetes",
		icon: Cloud,
		path: "/app/kubernetes",
		shortcut: "G K",
	},
	{ label: "Karşılaştır", icon: GitCompare, path: "/app/compare" },
	{ label: "Ayarlar", icon: Settings, path: "/app/settings" },
];

const ACTION_ITEMS: { label: string; icon: React.ElementType; key: string }[] =
	[
		{ label: "Yeni Servis Ekle", icon: Plus, key: "add-service" },
		{ label: "Tam Analiz Çalıştır", icon: Sparkles, key: "analyze" },
		{
			label: "Tüm Servisleri Yeniden Başlat",
			icon: RotateCw,
			key: "restart-all",
		},
		{ label: "Sistem Sağlık Kontrolü", icon: Activity, key: "health-check" },
	];

function statusColor(status: string) {
	if (status === "up") return "var(--status-up)";
	if (status === "degraded") return "var(--status-degraded)";
	return "var(--status-down)";
}

function statusBg(status: string) {
	if (status === "up") return "var(--status-up-subtle)";
	if (status === "degraded") return "var(--status-degraded-subtle)";
	return "var(--status-down-subtle)";
}

function statusText(status: string) {
	if (status === "up") return "var(--status-up-text)";
	if (status === "degraded") return "var(--status-degraded-text)";
	return "var(--status-down-text)";
}

function statusLabel(status: string) {
	if (status === "up") return "Aktif";
	if (status === "degraded") return "Bozuk";
	return "Kapalı";
}

function detectMode(value: string): Mode {
	if (!value) return "search";
	const c = value[0];
	if (c === "/") return "slash";
	if (c === "?") return "ask";
	if (c === ">") return "context";
	return "search";
}

function ModeChip({ mode }: { mode: Mode }) {
	const labels: Record<Mode, { label: string; tone: string }> = {
		search: { label: "Ara", tone: "var(--text-tertiary)" },
		slash: { label: "Komut", tone: "var(--brand-primary)" },
		ask: { label: "AI'ye Sor", tone: "var(--brand-primary)" },
		context: { label: "Sayfa Aksiyonları", tone: "var(--text-secondary)" },
	};
	const { label, tone } = labels[mode];
	return (
		<span
			className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
			style={{
				color: tone,
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{label}
		</span>
	);
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const { services } = useServiceStore();
	const openAIAssistant = useAIAssistantStore((s) => s.open);
	const gPressedRef = useRef(false);
	const gTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const mode = detectMode(query);
	const queryStripped = useMemo(() => {
		if (mode === "search") return query;
		return query.slice(1).trimStart();
	}, [query, mode]);

	useEffect(() => {
		const VIM_NAV: Record<string, string> = {
			d: "/app",
			s: "/app/services",
			a: "/app/alerts",
			i: "/app/ai-insights",
			m: "/app/service-map",
			k: "/app/kubernetes",
		};

		const down = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const isEditable =
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				(e.target as HTMLElement)?.isContentEditable;

			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((prev) => !prev);
				return;
			}

			if (open && e.metaKey) {
				const num = Number.parseInt(e.key, 10);
				if (num >= 1 && num <= 5) {
					e.preventDefault();
					const item = NAV_ITEMS[num - 1];
					if (item) {
						navigate(item.path);
						setOpen(false);
					}
				}
				return;
			}

			if (!open && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
				if (e.key === "g") {
					gPressedRef.current = true;
					clearTimeout(gTimerRef.current);
					gTimerRef.current = setTimeout(() => {
						gPressedRef.current = false;
					}, 800);
					return;
				}
				if (gPressedRef.current && e.key in VIM_NAV) {
					e.preventDefault();
					gPressedRef.current = false;
					clearTimeout(gTimerRef.current);
					navigate(VIM_NAV[e.key]);
				}
			}
		};

		document.addEventListener("keydown", down);
		return () => {
			document.removeEventListener("keydown", down);
			clearTimeout(gTimerRef.current);
		};
	}, [open, navigate]);

	useEffect(() => {
		if (!open) {
			setQuery("");
		}
	}, [open]);

	const close = useCallback(() => {
		setOpen(false);
	}, []);

	const handleNavigate = useCallback(
		(path: string) => {
			navigate(path);
			close();
		},
		[navigate, close],
	);

	const handleAction = useCallback(
		(action: string) => {
			if (action === "add-service") navigate("/app/services");
			else if (action === "analyze") openAIAssistant({ mode: "report" });
			else if (action === "health-check") navigate("/app");
			close();
		},
		[navigate, close, openAIAssistant],
	);

	const handleServiceAction = useCallback(
		async (
			serviceId: string,
			serviceName: string,
			action: "start" | "restart" | "stop",
		) => {
			close();
			try {
				if (action === "start") await servicesApi.start(serviceId);
				else if (action === "restart") await servicesApi.restart(serviceId);
				else if (action === "stop") await servicesApi.stop(serviceId);
				toast.success(`${serviceName}: komut gönderildi`);
			} catch {
				toast.error(`${serviceName}: komut gönderilemedi`);
			}
		},
		[close],
	);

	const handleAskSubmit = useCallback(() => {
		if (!queryStripped) return;
		openAIAssistant({ mode: "chat", seed: queryStripped });
		close();
	}, [queryStripped, openAIAssistant, close]);

	const handleSlashSubmit = useCallback(() => {
		const parts = queryStripped.split(/\s+/).filter(Boolean);
		if (parts.length === 0) return;
		const [verb, ...rest] = parts;
		const target = rest.join(" ");

		if (verb === "go" || verb === "git") {
			const match = NAV_ITEMS.find((n) =>
				n.label
					.toLocaleLowerCase("tr-TR")
					.includes(target.toLocaleLowerCase("tr-TR")),
			);
			if (match) handleNavigate(match.path);
			else toast.error(`Sayfa bulunamadı: ${target}`);
			return;
		}
		if (verb === "restart" || verb === "start" || verb === "stop") {
			const svc = services.find(
				(s) =>
					s.name.toLocaleLowerCase("tr-TR") ===
						target.toLocaleLowerCase("tr-TR") || s.id === target,
			);
			if (svc) {
				handleServiceAction(
					svc.id,
					svc.name,
					verb as "start" | "restart" | "stop",
				);
			} else {
				toast.error(`Servis bulunamadı: ${target}`);
			}
			return;
		}
		toast.error(`Bilinmeyen komut: /${verb}`);
	}, [queryStripped, services, handleNavigate, handleServiceAction]);

	return (
		<>
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.12 }}
						className="fixed inset-0 z-50"
						style={{
							backgroundColor: "rgba(0,0,0,0.4)",
							backdropFilter: "blur(2px)",
						}}
						onClick={close}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -8, scale: 0.98 }}
						transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
						className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
					>
						<Command
							shouldFilter={mode === "search"}
							className="rounded-[10px] overflow-hidden"
							style={{
								background: "var(--surface-overlay)",
								border: "1px solid var(--border-subtle)",
								boxShadow: "var(--shadow-lg)",
							}}
							onKeyDown={(e) => {
								if (e.key === "Backspace" && query.length === 1) {
									setQuery("");
								}
								if (e.key === "Enter") {
									if (mode === "ask") {
										e.preventDefault();
										handleAskSubmit();
									}
									if (mode === "slash" && queryStripped) {
										// Let CommandItem capture if there's a match; otherwise fall
										// back to slash dispatch.
										if (
											!document.querySelector(
												'[cmdk-item][aria-selected="true"]',
											)
										) {
											e.preventDefault();
											handleSlashSubmit();
										}
									}
								}
							}}
						>
							<div
								className="flex items-center justify-between px-3 pt-2.5 pb-1.5"
								style={{ borderBottom: "1px solid var(--border-subtle)" }}
							>
								<div className="flex items-center gap-2">
									<ModeChip mode={mode} />
									<span
										className="text-[11px]"
										style={{ color: "var(--text-faint)" }}
									>
										{mode === "search" && "Sayfa, servis veya komut yaz"}
										{mode === "slash" && "Slash komutu — `/restart svc-adı`"}
										{mode === "ask" && "Sorunu yaz — Enter ile gönder"}
										{mode === "context" && "Aktif sayfa için aksiyonlar"}
									</span>
								</div>
								<kbd
									className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
										color: "var(--text-faint)",
									}}
								>
									ESC
								</kbd>
							</div>

							<CommandInput
								placeholder={
									mode === "search"
										? "Komut yaz veya ara…   (?  AI'ye sor   /  komut)"
										: mode === "slash"
											? "/restart api-gateway"
											: mode === "ask"
												? "?  Servis neden 502 dönüyor?"
												: ">  Bu sayfada yapılabilecekler"
								}
								value={query}
								onValueChange={setQuery}
								className="text-[13px]"
								style={{ color: "var(--text-primary)" }}
							/>

							<CommandList className="max-h-[420px] px-1.5 pb-1.5">
								<CommandEmpty>
									<div
										className="flex flex-col items-center gap-2 py-8 text-[13px]"
										style={{ color: "var(--text-tertiary)" }}
									>
										<Search
											className="w-6 h-6"
											style={{ color: "var(--text-faint)" }}
										/>
										{mode === "ask"
											? "AI'ye gönder: Enter"
											: mode === "slash"
												? "Tanınan komut yok"
												: "Sonuç bulunamadı"}
									</div>
								</CommandEmpty>

								{/* ── ASK MODE ──────────────────────────────────────── */}
								{mode === "ask" && queryStripped && (
									<CommandGroup heading="AI'ye gönder">
										<CommandItem
											value={`ask-${queryStripped}`}
											onSelect={handleAskSubmit}
											className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] cursor-pointer"
											style={{ color: "var(--text-primary)" }}
										>
											<Sparkles
												className="w-4 h-4 shrink-0"
												style={{ color: "var(--brand-primary)" }}
											/>
											<span className="flex-1 text-[13px] truncate">
												{queryStripped}
											</span>
											<CornerDownLeft
												className="w-3.5 h-3.5"
												style={{ color: "var(--text-faint)" }}
											/>
										</CommandItem>
									</CommandGroup>
								)}

								{/* ── SLASH / SEARCH — Navigation ───────────────────── */}
								{(mode === "search" || mode === "slash") && (
									<CommandGroup heading="Navigasyon">
										{NAV_ITEMS.map((item) => (
											<CommandItem
												key={item.path}
												value={`go ${item.label}`}
												onSelect={() => handleNavigate(item.path)}
												onMouseEnter={() => preloadRoute(item.path)}
												className="flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer"
												style={{ color: "var(--text-secondary)" }}
											>
												<item.icon
													className="w-4 h-4 shrink-0"
													style={{ color: "var(--text-tertiary)" }}
												/>
												<span className="flex-1 text-[13px]">{item.label}</span>
												{item.shortcut && (
													<kbd
														className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
														style={{
															background: "var(--surface-sunken)",
															border: "1px solid var(--border-subtle)",
															color: "var(--text-faint)",
														}}
													>
														{item.shortcut}
													</kbd>
												)}
											</CommandItem>
										))}
									</CommandGroup>
								)}

								{/* ── Services list ─────────────────────────────────── */}
								{(mode === "search" || mode === "slash") &&
									services.length > 0 && (
										<>
											<CommandSeparator
												className="my-1"
												style={{
													backgroundColor: "var(--border-subtle)",
												}}
											/>
											<CommandGroup heading="Servisler">
												{services.slice(0, 8).map((service) => (
													<CommandItem
														key={service.id}
														value={`svc ${service.name}`}
														onSelect={() =>
															handleNavigate(`/app/services/${service.id}`)
														}
														onMouseEnter={() =>
															preloadRoute(`/app/services/${service.id}`)
														}
														className="flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer"
														style={{ color: "var(--text-secondary)" }}
													>
														<div className="relative shrink-0">
															<Server
																className="w-4 h-4"
																style={{ color: "var(--text-tertiary)" }}
															/>
															<span
																className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
																style={{
																	background: statusColor(service.status),
																}}
															/>
														</div>
														<span className="flex-1 text-[13px] font-mono">
															{service.name}
														</span>
														<span
															className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
															style={{
																background: statusBg(service.status),
																color: statusText(service.status),
															}}
														>
															{statusLabel(service.status)}
														</span>
													</CommandItem>
												))}
											</CommandGroup>

											{/* Service control verbs */}
											<CommandSeparator
												className="my-1"
												style={{
													backgroundColor: "var(--border-subtle)",
												}}
											/>
											<CommandGroup heading="Servis Kontrolleri">
												{services
													.slice(0, 3)
													.flatMap((service) => [
														{
															key: `${service.id}-restart`,
															icon: RefreshCw,
															label: `Yeniden başlat — ${service.name}`,
															value: `restart ${service.name}`,
															color: "var(--brand-primary)",
															action: () =>
																handleServiceAction(
																	service.id,
																	service.name,
																	"restart",
																),
														},
														{
															key: `${service.id}-start`,
															icon: Play,
															label: `Başlat — ${service.name}`,
															value: `start ${service.name}`,
															color: "var(--status-up-text)",
															action: () =>
																handleServiceAction(
																	service.id,
																	service.name,
																	"start",
																),
														},
														{
															key: `${service.id}-stop`,
															icon: Power,
															label: `Durdur — ${service.name}`,
															value: `stop ${service.name}`,
															color: "var(--status-degraded-text)",
															action: () =>
																handleServiceAction(
																	service.id,
																	service.name,
																	"stop",
																),
														},
													])
													.map((item) => (
														<CommandItem
															key={item.key}
															value={item.value}
															onSelect={item.action}
															className="flex items-center gap-3 px-3 py-1.5 rounded-[6px] cursor-pointer"
															style={{ color: "var(--text-secondary)" }}
														>
															<item.icon
																className="w-3.5 h-3.5 shrink-0"
																style={{ color: item.color }}
															/>
															<span className="flex-1 text-[13px]">
																{item.label}
															</span>
														</CommandItem>
													))}
											</CommandGroup>
										</>
									)}

								{/* ── Quick actions ─────────────────────────────────── */}
								{(mode === "search" || mode === "context") && (
									<>
										<CommandSeparator
											className="my-1"
											style={{ backgroundColor: "var(--border-subtle)" }}
										/>
										<CommandGroup heading="Aksiyonlar">
											{ACTION_ITEMS.map((action) => (
												<CommandItem
													key={action.key}
													value={`act ${action.label}`}
													onSelect={() => handleAction(action.key)}
													className="flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer"
													style={{ color: "var(--text-secondary)" }}
												>
													<action.icon
														className="w-4 h-4 shrink-0"
														style={{ color: "var(--text-tertiary)" }}
													/>
													<span className="flex-1 text-[13px]">
														{action.label}
													</span>
													<ArrowRight
														className="w-3.5 h-3.5"
														style={{ color: "var(--text-faint)" }}
													/>
												</CommandItem>
											))}
										</CommandGroup>
									</>
								)}
							</CommandList>

							<div
								className="flex items-center gap-3 px-3 py-2 text-[10px]"
								style={{
									borderTop: "1px solid var(--border-subtle)",
									color: "var(--text-faint)",
								}}
							>
								{[
									{ key: "↑↓", label: "git" },
									{ key: "↵", label: "seç" },
									{ key: "?", label: "AI" },
									{ key: "/", label: "komut" },
									{ key: `${MOD_KEY}K`, label: "aç/kapat" },
								].map(({ key, label }) => (
									<span key={key} className="flex items-center gap-1">
										<kbd
											className="px-1 py-0.5 rounded text-[10px] font-mono font-semibold"
											style={{
												background: "var(--surface-sunken)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											{key}
										</kbd>
										{label}
									</span>
								))}
							</div>
						</Command>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
