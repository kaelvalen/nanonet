import {
	Activity,
	AlertCircle,
	Cloud,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { servicesApi } from "@/api/services";
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

const navigationItems = [
	{ label: "Ana Sayfa", icon: Home, path: "/app", shortcut: "⌘1" },
	{ label: "Servisler", icon: Server, path: "/app/services", shortcut: "⌘2" },
	{ label: "Uyarılar", icon: AlertCircle, path: "/app/alerts", shortcut: "⌘3" },
	{
		label: "AI İçgörüler",
		icon: Sparkles,
		path: "/app/ai-insights",
		shortcut: "⌘4",
	},
	{ label: "Kubernetes", icon: Cloud, path: "/app/kubernetes", shortcut: "⌘5" },
	{ label: "Karşılaştır", icon: GitCompare, path: "/app/compare", shortcut: "⌘6" },
	{ label: "Ayarlar", icon: Settings, path: "/app/settings", shortcut: "⌘7" },
];

const actionItems = [
	{ label: "Yeni Servis Ekle", icon: Plus, action: "add-service" },
	{ label: "Tam Analiz Çalıştır", icon: Sparkles, action: "analyze" },
	{
		label: "Tüm Servisleri Yeniden Başlat",
		icon: RotateCw,
		action: "restart-all",
	},
	{ label: "Sistem Sağlık Kontrolü", icon: Activity, action: "health-check" },
];

function statusColor(status: string) {
	if (status === "up") return "var(--status-up)";
	if (status === "degraded") return "var(--status-warn)";
	return "var(--status-down)";
}

function statusBg(status: string) {
	if (status === "up") return "var(--status-up-subtle)";
	if (status === "degraded") return "var(--status-warn-subtle)";
	return "var(--status-down-subtle)";
}

function statusText(status: string) {
	if (status === "up") return "var(--status-up-text)";
	if (status === "degraded") return "var(--status-warn-text)";
	return "var(--status-down-text)";
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();
	const { services } = useServiceStore();
	const gPressedRef = useRef(false);
	const gTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
				const num = parseInt(e.key, 10);
				if (num >= 1 && num <= 5) {
					e.preventDefault();
					const item = navigationItems[num - 1];
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

	const handleNavigate = useCallback(
		(path: string) => {
			navigate(path);
			setOpen(false);
		},
		[navigate],
	);

	const handleAction = useCallback(
		(action: string) => {
			if (action === "add-service") navigate("/app/services");
			else if (action === "analyze") navigate("/app/ai-insights");
			setOpen(false);
		},
		[navigate],
	);

	const handleServiceAction = useCallback(
		async (
			serviceId: string,
			serviceName: string,
			action: "start" | "restart" | "stop",
		) => {
			setOpen(false);
			try {
				if (action === "start") await servicesApi.start(serviceId);
				else if (action === "restart") await servicesApi.restart(serviceId);
				else if (action === "stop") await servicesApi.stop(serviceId);
				toast.success(`${serviceName}: komut gönderildi`);
			} catch {
				toast.error(`${serviceName}: komut gönderilemedi`);
			}
		},
		[],
	);

	return (
		<>
			{/* Backdrop */}
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50"
						style={{
							backgroundColor: "rgba(0,0,0,0.4)",
							backdropFilter: "blur(2px)",
						}}
						onClick={() => setOpen(false)}
					/>
				)}
			</AnimatePresence>

			{/* Panel */}
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -12, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -12, scale: 0.97 }}
						transition={{ type: "spring", stiffness: 400, damping: 30 }}
						className="fixed top-[12%] left-1/2 -translate-x-1/2 z-51 w-full max-w-2xl px-4"
					>
						<Command
							className="rounded-xl overflow-hidden"
							style={{
								background: "var(--surface-raised)",
								border: "1px solid var(--border-default)",
								boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
							}}
						>
							{/* Header */}
							<div
								className="flex items-center justify-between px-4 pt-3 pb-2"
								style={{ borderBottom: "1px solid var(--border-subtle)" }}
							>
								<span
									className="text-xs font-medium"
									style={{ color: "var(--text-muted)" }}
								>
									NanoNet Komut
								</span>
								<kbd
									className="text-[10px] px-1.5 py-0.5 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-default)",
										color: "var(--text-faint)",
									}}
								>
									ESC
								</kbd>
							</div>

							<CommandInput
								placeholder="Komut yaz veya ara..."
								className="text-sm"
								style={{ color: "var(--text-secondary)" }}
							/>

							<CommandList className="max-h-96 px-1.5 pb-1.5">
								<CommandEmpty>
									<div
										className="flex flex-col items-center gap-2 py-8 text-sm"
										style={{ color: "var(--text-muted)" }}
									>
										<Search
											className="w-7 h-7"
											style={{ color: "var(--text-faint)" }}
										/>
										Sonuç bulunamadı
									</div>
								</CommandEmpty>

								{/* Navigation */}
								<CommandGroup heading="Navigasyon">
									{navigationItems.map((item) => (
										<CommandItem
											key={item.path}
											onSelect={() => handleNavigate(item.path)}
											className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
											style={{ color: "var(--text-secondary)" }}
										>
											<item.icon
												className="w-4 h-4 shrink-0"
												style={{ color: "var(--text-muted)" }}
											/>
											<span className="flex-1 text-sm">{item.label}</span>
											<kbd
												className="text-[10px] px-1.5 py-0.5 rounded"
												style={{
													background: "var(--surface-sunken)",
													border: "1px solid var(--border-subtle)",
													color: "var(--text-faint)",
												}}
											>
												{item.shortcut}
											</kbd>
										</CommandItem>
									))}
								</CommandGroup>

								{services.length > 0 && (
									<>
										<CommandSeparator
											className="my-1"
											style={{ backgroundColor: "var(--border-subtle)" }}
										/>

										{/* Services */}
										<CommandGroup heading="Servisler">
											{services.map((service) => (
												<CommandItem
													key={service.id}
													onSelect={() =>
														handleNavigate(`/app/services/${service.id}`)
													}
													className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
													style={{ color: "var(--text-secondary)" }}
												>
													<div className="relative shrink-0">
														<Server
															className="w-4 h-4"
															style={{ color: "var(--text-muted)" }}
														/>
														<span
															className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
															style={{
																background: statusColor(service.status),
															}}
														/>
													</div>
													<span className="flex-1 text-sm font-mono">
														{service.name}
													</span>
													<span
														className="text-[10px] px-1.5 py-0.5 rounded-md"
														style={{
															background: statusBg(service.status),
															color: statusText(service.status),
														}}
													>
														{service.status === "up"
															? "Aktif"
															: service.status === "degraded"
																? "Bozuk"
																: "Kapalı"}
													</span>
												</CommandItem>
											))}
										</CommandGroup>

										<CommandSeparator
											className="my-1"
											style={{ backgroundColor: "var(--border-subtle)" }}
										/>

										{/* Service controls (first 3 services only) */}
										<CommandGroup heading="Servis Kontrolleri">
											{services
												.slice(0, 3)
												.flatMap((service) => [
													{
														key: `${service.id}-start`,
														icon: Play,
														label: `Başlat — ${service.name}`,
														color: "var(--status-up-text)",
														action: () =>
															handleServiceAction(
																service.id,
																service.name,
																"start",
															),
													},
													{
														key: `${service.id}-restart`,
														icon: RefreshCw,
														label: `Yeniden Başlat — ${service.name}`,
														color: "var(--color-teal)",
														action: () =>
															handleServiceAction(
																service.id,
																service.name,
																"restart",
															),
													},
													{
														key: `${service.id}-stop`,
														icon: Power,
														label: `Durdur — ${service.name}`,
														color: "var(--status-warn-text)",
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
														onSelect={item.action}
														className="flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer"
														style={{ color: "var(--text-secondary)" }}
													>
														<item.icon
															className="w-3.5 h-3.5 shrink-0"
															style={{ color: item.color }}
														/>
														<span className="flex-1 text-sm">{item.label}</span>
													</CommandItem>
												))}
										</CommandGroup>

										<CommandSeparator
											className="my-1"
											style={{ backgroundColor: "var(--border-subtle)" }}
										/>
									</>
								)}

								{/* Actions */}
								<CommandGroup heading="Aksiyonlar">
									{actionItems.map((action) => (
										<CommandItem
											key={action.action}
											onSelect={() => handleAction(action.action)}
											className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
											style={{ color: "var(--text-secondary)" }}
										>
											<action.icon
												className="w-4 h-4 shrink-0"
												style={{ color: "var(--text-muted)" }}
											/>
											<span className="flex-1 text-sm">{action.label}</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>

							{/* Footer */}
							<div
								className="flex items-center gap-4 px-4 py-2 text-[10px] font-mono"
								style={{
									borderTop: "1px solid var(--border-subtle)",
									color: "var(--text-faint)",
								}}
							>
								{[
									{ key: "↑↓", label: "navigate" },
									{ key: "↵", label: "select" },
									{ key: "⌘K", label: "toggle" },
									{ key: "g+d/s/a", label: "quick nav" },
								].map(({ key, label }) => (
									<span key={key} className="flex items-center gap-1">
										<kbd
											className="px-1 py-0.5 rounded text-[10px]"
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
