import {
	Background,
	Controls,
	ReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	Brain,
	Check,
	GitFork,
	Loader2,
	Plus,
	RotateCcw,
	Save,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import {
	STATUS_BG,
	STATUS_COLOR,
	STATUS_LABEL,
} from "./constants";
import { RightPanel } from "./RightPanel";
import { ServiceNode } from "./ServiceNode";
import { StatusEdge } from "./StatusEdge";
import { useMapState } from "./useMapState";

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { statusEdge: StatusEdge };

function ServiceMapInner() {
	const {
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		isLoading,
		services,
		selectedService,
		setSelectedServiceId,
		addMode,
		setAddMode,
		resetAsking,
		setResetAsking,
		handleSave,
		handleReset,
		addServiceToMap,
		addableServices,
		statusCounts,
		edgeCount,
	} = useMapState();

	const addMenuRef = useRef<HTMLDivElement>(null);

	// Close add-menu on outside click
	useEffect(() => {
		if (!addMode) return;
		const onClick = (e: MouseEvent) => {
			if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
				setAddMode(false);
			}
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [addMode, setAddMode]);

	return (
		<div
			className="relative flex-1 min-h-0 flex flex-col"
			style={{ background: "var(--bg-primary)" }}
		>
			{/* ─────────── Subtoolbar ─────────── */}
			<div
				className="flex items-center gap-3 px-4 sm:px-6 py-3 shrink-0 flex-wrap"
				style={{
					borderBottom: "1px solid var(--border-subtle)",
					background:
						"color-mix(in srgb, var(--surface-card) 60%, transparent)",
					backdropFilter: "blur(8px)",
				}}
			>
				{/* AI badge */}
				<span
					className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium shrink-0"
					style={{
						background:
							"color-mix(in srgb, var(--color-violet) 12%, transparent)",
						color: "var(--color-violet)",
					}}
				>
					<Brain className="w-3.5 h-3.5" />
					AI destekli
				</span>

				<span
					className="hidden lg:inline-block w-px h-5"
					style={{ background: "var(--border-default)" }}
				/>

				{/* Status pill */}
				<div
					className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
					style={{ background: "var(--surface-sunken)" }}
				>
					{(
						[
							{ status: "up", label: "Çalışıyor" },
							{ status: "degraded", label: "Yavaş" },
							{ status: "down", label: "Çökmüş" },
						] as const
					).map(({ status, label }) => {
						const count = statusCounts[status];
						const breathing = status !== "up" && count > 0;
						return (
							<div
								key={status}
								className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full"
								title={label}
							>
								<span
									className="relative flex items-center justify-center w-3 h-3"
									aria-hidden
								>
									{breathing && (
										<span
											className="absolute inset-0 rounded-full"
											style={{
												background: STATUS_COLOR[status],
												opacity: 0.3,
												animation:
													"nn-orb-breathe 2.4s ease-in-out infinite",
											}}
										/>
									)}
									<span
										className="relative w-1.5 h-1.5 rounded-full"
										style={{ background: STATUS_COLOR[status] }}
									/>
								</span>
								<span
									className="text-[12px] font-semibold tabular-nums"
									style={{ color: STATUS_COLOR[status] }}
								>
									{count}
								</span>
								<span
									className="text-[11px] hidden md:inline"
									style={{ color: "var(--text-muted)" }}
								>
									{label}
								</span>
							</div>
						);
					})}
				</div>

				<span
					className="hidden md:inline-flex items-center h-8 px-3 rounded-full text-[12px] font-medium"
					style={{
						background: "var(--surface-sunken)",
						color: "var(--text-muted)",
					}}
				>
					<span className="tabular-nums mr-1">{edgeCount}</span>
					bağlantı
				</span>

				<div className="flex-1" />

				<span
					className="hidden xl:flex items-center gap-1.5 text-[11px]"
					style={{ color: "var(--text-faint)" }}
				>
					<kbd
						className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						Del
					</kbd>
					seçili öğeyi sil
				</span>

				{addableServices.length > 0 && (
					<div className="relative" ref={addMenuRef}>
						<button
							type="button"
							onClick={() => setAddMode((v) => !v)}
							className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-all"
							style={{
								background: addMode
									? "color-mix(in srgb, var(--color-teal) 12%, transparent)"
									: "var(--surface-sunken)",
								color: addMode ? "var(--color-teal)" : "var(--text-muted)",
							}}
						>
							<Plus className="w-3.5 h-3.5" />
							Servis ekle
							<span
								className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full font-semibold"
								style={{
									background: addMode
										? "color-mix(in srgb, var(--color-teal) 18%, transparent)"
										: "var(--surface-card)",
									color: addMode
										? "var(--color-teal)"
										: "var(--text-faint)",
								}}
							>
								{addableServices.length}
							</span>
						</button>
						<AnimatePresence>
							{addMode && (
								<motion.div
									initial={{ opacity: 0, y: -8, scale: 0.96 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: -8, scale: 0.96 }}
									transition={{ duration: 0.18 }}
									className="absolute top-10 right-0 z-30 rounded-2xl p-1.5 min-w-64 max-h-80 overflow-y-auto"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
										boxShadow:
											"0 16px 40px -10px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.04)",
									}}
								>
									<p
										className="text-[11px] font-medium px-3 py-2"
										style={{ color: "var(--text-faint)" }}
									>
										Haritaya ekle
									</p>
									{addableServices.map((svc) => (
										<button
											type="button"
											key={svc.id}
											onClick={() => addServiceToMap(svc)}
											className="w-full text-left px-3 py-2 rounded-xl text-[13px] flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
											style={{ color: "var(--text-secondary)" }}
										>
											<span
												className="w-2 h-2 rounded-full shrink-0"
												style={{
													background:
														STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown,
												}}
											/>
											<span className="truncate flex-1 font-medium">
												{svc.name}
											</span>
											<span
												className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full font-medium"
												style={{
													color:
														STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown,
													background: STATUS_BG[svc.status],
												}}
											>
												{STATUS_LABEL[svc.status]}
											</span>
										</button>
									))}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				)}

				<button
					type="button"
					onClick={handleSave}
					className="flex items-center gap-1.5 h-8 px-4 rounded-full text-[12px] font-semibold text-white transition-all hover:opacity-90"
					style={{ background: "var(--gradient-btn-primary)" }}
				>
					<Save className="w-3.5 h-3.5" />
					Kaydet
				</button>

				{resetAsking ? (
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handleReset}
							className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold"
							style={{
								background: "var(--status-down-subtle)",
								color: "var(--status-down-text)",
							}}
						>
							<Check className="w-3 h-3" /> Eminim
						</button>
						<button
							type="button"
							onClick={() => setResetAsking(false)}
							className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--surface-sunken)]"
							style={{ color: "var(--text-muted)" }}
							aria-label="İptal"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setResetAsking(true)}
						className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
						style={{ color: "var(--text-muted)" }}
					>
						<RotateCcw className="w-3.5 h-3.5" />
						Sıfırla
					</button>
				)}
			</div>

			{/* ─────────── Canvas ─────────── */}
			<div className="relative flex-1 min-h-0">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					fitView
					fitViewOptions={{ padding: 0.25 }}
					proOptions={{ hideAttribution: true }}
					style={{
						width: "100%",
						height: "100%",
						background: "var(--bg-primary)",
					}}
					deleteKeyCode="Delete"
					onPaneClick={() => setSelectedServiceId(null)}
				>
					<Background color="var(--border-subtle)" gap={28} size={1} />
					<Controls
						style={{
							background:
								"color-mix(in srgb, var(--surface-card) 92%, transparent)",
							border: "1px solid var(--border-default)",
							backdropFilter: "blur(8px)",
							boxShadow:
								"0 12px 28px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.02)",
							borderRadius: "12px",
							overflow: "hidden",
						}}
					/>
				</ReactFlow>

				{/* Loading / empty overlays */}
				{isLoading && services.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="flex items-center gap-2">
							<Loader2
								className="w-4 h-4 animate-spin"
								style={{ color: "var(--text-faint)" }}
							/>
							<p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
								Servisler yükleniyor…
							</p>
						</div>
					</div>
				)}
				{!isLoading && services.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div
							className="text-center px-6 py-8 rounded-2xl pointer-events-auto"
							style={{
								background:
									"color-mix(in srgb, var(--surface-card) 70%, transparent)",
								backdropFilter: "blur(8px)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<div
								className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
								style={{
									background:
										"color-mix(in srgb, var(--color-teal) 12%, transparent)",
									color: "var(--color-teal)",
								}}
							>
								<GitFork className="w-5 h-5" />
							</div>
							<p
								className="text-[14px] font-semibold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Henüz servis yok
							</p>
							<p
								className="text-[12px] mt-1"
								style={{ color: "var(--text-muted)" }}
							>
								Önce Servisler sayfasından bir servis ekleyin.
							</p>
						</div>
					</div>
				)}

				{/* Right panel — overlay so canvas doesn't reflow */}
				<AnimatePresence>
					{selectedService && (
						<div
							className="absolute top-0 right-0 bottom-0 z-20 pointer-events-none"
							aria-hidden={false}
						>
							<div className="h-full pointer-events-auto">
								<RightPanel
									service={selectedService}
									onClose={() => setSelectedServiceId(null)}
								/>
							</div>
						</div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

export function ServiceMap() {
	return (
		<ReactFlowProvider>
			<ServiceMapInner />
		</ReactFlowProvider>
	);
}
