import {
	Background,
	Controls,
	ReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Loader2, Plus, RotateCcw, Save, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useRef } from "react";
import {
	STATUS_BG,
	STATUS_BORDER,
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

	return (
		<div
			className="flex"
			style={{ background: "var(--bg-primary)", flex: 1, minHeight: 0 }}
		>
			{/* Canvas area */}
			<div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
				{/* Toolbar */}
				<div
					className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					{/* Status counts */}
					<div className="flex items-center gap-2 mr-1">
						{(
							[
								{ status: "up", label: "Çalışıyor" },
								{ status: "degraded", label: "Yavaş" },
								{ status: "down", label: "Çökmüş" },
							] as const
						).map(({ status, label }) => (
							<div
								key={status}
								className="flex items-center gap-1 px-2 py-0.5 rounded"
								style={{
									background: STATUS_BG[status],
									border: `1px solid ${STATUS_BORDER[status]}`,
								}}
							>
								<div
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: STATUS_COLOR[status] }}
								/>
								<span
									className="text-[10px] font-semibold tabular-nums"
									style={{ color: STATUS_COLOR[status] }}
								>
									{statusCounts[status]}
								</span>
								<span
									className="text-[10px] hidden sm:inline"
									style={{ color: "var(--text-faint)" }}
								>
									{label}
								</span>
							</div>
						))}
					</div>

					<span
						className="text-[10px] px-2 py-0.5 rounded"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
							color: "var(--text-faint)",
						}}
					>
						{edgeCount} bağlantı
					</span>

					<div className="flex-1" />

					<span
						className="hidden md:flex items-center gap-1 text-[10px]"
						style={{ color: "var(--text-faint)" }}
					>
						<kbd
							className="px-1 py-0.5 rounded text-[9px]"
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
								className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border transition-all"
								style={{
									background: addMode
										? "var(--color-teal-subtle)"
										: "transparent",
									borderColor: addMode
										? "var(--color-teal-border)"
										: "var(--border-default)",
									color: addMode ? "var(--color-teal)" : "var(--text-muted)",
								}}
							>
								<Plus className="w-3 h-3" />
								Servis Ekle ({addableServices.length})
							</button>
							{addMode && (
								<div
									className="absolute top-9 right-0 z-20 rounded p-2 min-w-52 max-h-72 overflow-y-auto space-y-0.5"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
										boxShadow: "var(--card-shadow)",
									}}
								>
									<p
										className="text-[10px] uppercase tracking-wider px-2 pb-1.5 mb-1"
										style={{
											color: "var(--text-faint)",
											borderBottom: "1px solid var(--border-subtle)",
										}}
									>
										Haritaya ekle
									</p>
									{addableServices.map((svc) => (
										<button
											type="button"
											key={svc.id}
											onClick={() => addServiceToMap(svc)}
											className="w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-opacity hover:opacity-70"
											style={{ color: "var(--text-secondary)" }}
										>
											<div
												className="w-2 h-2 rounded-full shrink-0"
												style={{
													background:
														STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown,
												}}
											/>
											<span className="truncate flex-1">{svc.name}</span>
											<span
												className="text-[9px] shrink-0"
												style={{
													color:
														STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown,
												}}
											>
												{STATUS_LABEL[svc.status]}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					<button
						type="button"
						onClick={handleSave}
						className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border transition-all"
						style={{
							borderColor: "var(--color-teal-border)",
							color: "var(--color-teal)",
						}}
					>
						<Save className="w-3 h-3" />
						Kaydet
					</button>

					{resetAsking ? (
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={handleReset}
								className="flex items-center gap-1 px-2 h-7 rounded text-[10px] font-semibold border"
								style={{
									background: "var(--status-down-subtle)",
									borderColor: "var(--status-down-border)",
									color: "var(--status-down-text)",
								}}
							>
								<Check className="w-3 h-3" /> Sıfırla
							</button>
							<button
								type="button"
								onClick={() => setResetAsking(false)}
								className="w-7 h-7 rounded flex items-center justify-center border"
								style={{
									borderColor: "var(--border-subtle)",
									color: "var(--text-muted)",
								}}
							>
								<X className="w-3 h-3" />
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setResetAsking(true)}
							className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border transition-all"
							style={{
								borderColor: "var(--border-default)",
								color: "var(--text-muted)",
							}}
						>
							<RotateCcw className="w-3 h-3" />
							Sıfırla
						</button>
					)}
				</div>

				{/* Canvas */}
				<div style={{ flex: 1, minHeight: 0, position: "relative" }}>
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
						style={{
							width: "100%",
							height: "100%",
							background: "var(--bg-primary)",
						}}
						deleteKeyCode="Delete"
						onPaneClick={() => setSelectedServiceId(null)}
					>
						<Background color="var(--border-subtle)" gap={24} size={1} />
						<Controls
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
								boxShadow: "var(--card-shadow)",
								borderRadius: "6px",
							}}
						/>
					</ReactFlow>

					{isLoading && services.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div className="flex items-center gap-2">
								<Loader2
									className="w-4 h-4 animate-spin"
									style={{ color: "var(--text-faint)" }}
								/>
								<p className="text-sm" style={{ color: "var(--text-faint)" }}>
									Servisler yükleniyor...
								</p>
							</div>
						</div>
					)}
					{!isLoading && services.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<p className="text-sm" style={{ color: "var(--text-faint)" }}>
								Henüz servis yok. Önce bir servis ekleyin.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Right panel */}
			<AnimatePresence>
				{selectedService && (
					<RightPanel
						service={selectedService}
						onClose={() => setSelectedServiceId(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

export function ServiceMap() {
	return (
		<ReactFlowProvider>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					flex: 1,
					minHeight: 0,
					height: "100%",
				}}
			>
				<ServiceMapInner />
			</div>
		</ReactFlowProvider>
	);
}
