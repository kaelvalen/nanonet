import { Eye, EyeOff, RotateCcw, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	DASHBOARD_WIDGETS,
	type DashboardWidgetSpec,
	useDashboardLayout,
} from "@/hooks/useDashboardLayout";

/**
 * Dashboard customization popover — lets the user toggle widget visibility
 * and density. State is persisted to localStorage via useDashboardLayout.
 */
export function DashboardCustomize() {
	const { config, toggle, setDensity, reset } = useDashboardLayout();

	const grouped = DASHBOARD_WIDGETS.reduce(
		(acc, w) => {
			(acc[w.group] = acc[w.group] ?? []).push(w);
			return acc;
		},
		{} as Record<string, DashboardWidgetSpec[]>,
	);

	const visibleCount = DASHBOARD_WIDGETS.filter(
		(w) => config.visible[w.id] !== false,
	).length;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors hover:bg-[var(--surface-sunken)]"
					style={{
						color: "var(--text-secondary)",
						border: "1px solid var(--border-default)",
					}}
					title="Panel düzenini özelleştir"
				>
					<Settings2 className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">Düzenle</span>
					<span
						className="hidden sm:inline tabular-nums text-[10px]"
						style={{ color: "var(--text-faint)" }}
					>
						{visibleCount}/{DASHBOARD_WIDGETS.length}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={8}
				className="w-[280px] p-0"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				<div
					className="flex items-center justify-between px-3 py-2.5"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					<div>
						<p
							className="text-xs font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							Panel düzeni
						</p>
						<p
							className="text-[10px]"
							style={{ color: "var(--text-faint)" }}
						>
							Görmek istediklerini seç
						</p>
					</div>
					<button
						type="button"
						onClick={reset}
						className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded hover:bg-[var(--surface-sunken)]"
						style={{ color: "var(--text-muted)" }}
						title="Varsayılana sıfırla"
					>
						<RotateCcw className="w-3 h-3" />
						Sıfırla
					</button>
				</div>

				{/* Density selector */}
				<div
					className="px-3 py-2.5"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					<p
						className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
						style={{ color: "var(--text-faint)" }}
					>
						Yoğunluk
					</p>
					<div
						className="inline-flex rounded-md p-0.5 gap-0.5 w-full"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-default)",
						}}
					>
						{(["compact", "comfortable"] as const).map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => setDensity(d)}
								className="flex-1 text-[11px] px-2 py-1 rounded font-medium transition-colors"
								style={{
									background:
										config.density === d
											? "var(--brand-primary)"
											: "transparent",
									color:
										config.density === d ? "#ffffff" : "var(--text-muted)",
								}}
							>
								{d === "compact" ? "Sıkı" : "Rahat"}
							</button>
						))}
					</div>
				</div>

				<div className="max-h-[420px] overflow-y-auto">
					{Object.entries(grouped).map(([group, widgets]) => (
						<div
							key={group}
							className="px-3 py-2"
							style={{ borderBottom: "1px solid var(--border-subtle)" }}
						>
							<p
								className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
								style={{ color: "var(--text-faint)" }}
							>
								{group}
							</p>
							<div className="flex flex-col gap-px">
								{widgets.map((w) => {
									const on = config.visible[w.id] !== false;
									return (
										<button
											key={w.id}
											type="button"
											onClick={() => toggle(w.id)}
											className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-[var(--surface-sunken)]"
											style={{ color: "var(--text-secondary)" }}
										>
											<span className="font-medium">{w.label}</span>
											{on ? (
												<Eye
													className="w-3.5 h-3.5"
													style={{ color: "var(--brand-primary)" }}
												/>
											) : (
												<EyeOff
													className="w-3.5 h-3.5"
													style={{ color: "var(--text-faint)" }}
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
