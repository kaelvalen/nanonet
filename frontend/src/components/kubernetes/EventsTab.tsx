import {
	Activity,
	AlertTriangle,
	Bell,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import React from "react";
import type { EventInfo } from "@/api/k8s";
import { Card } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface EventsTabProps {
	eventKindFilter: string;
	setEventKindFilter: (val: string) => void;
	eventTypeFilter: "" | "Warning" | "Normal";
	setEventTypeFilter: (val: "" | "Warning" | "Normal") => void;
	filteredEvents: EventInfo[];
	warningCount: number;
	eventsLoading: boolean;
	allEvents: EventInfo[];
	refetchEvents: () => void;
}

export function EventsTab({
	eventKindFilter,
	setEventKindFilter,
	eventTypeFilter,
	setEventTypeFilter,
	filteredEvents,
	warningCount,
	eventsLoading,
	allEvents,
	refetchEvents,
}: EventsTabProps) {
	return (
		<motion.div
			key="events"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			className="space-y-4"
		>
			<div className="flex items-center gap-2 flex-wrap">
				<div className="flex items-center gap-1">
					{(["", "Warning", "Normal"] as const).map((t) => (
						<button
							key={t || "all"}
							onClick={() => setEventTypeFilter(t)}
							className="px-3 py-1.5 rounded-xl text-xs border transition-all"
							style={
								eventTypeFilter === t
									? t === "Warning"
										? {
												background: "var(--status-warn-subtle)",
												borderColor: "var(--status-warn-border)",
												color: "var(--status-warn-text)",
											}
										: t === "Normal"
											? {
													background: "var(--status-up-subtle)",
													borderColor: "var(--status-up-border)",
													color: "var(--status-up-text)",
												}
											: {
													background:
														"color-mix(in srgb, var(--color-blue) 12%, transparent)",
													borderColor: "var(--color-blue-border)",
													color: "var(--color-blue)",
												}
									: {
											color: "var(--text-muted)",
											borderColor: "var(--border-subtle)",
											background: "transparent",
										}
							}
						>
							{t === "" ? "Tümü" : t}
						</button>
					))}
				</div>
				<Select value={eventKindFilter} onValueChange={setEventKindFilter}>
					<SelectTrigger
						className="rounded-xl text-xs h-8 w-36"
						style={{
							background: "var(--input-bg)",
							borderColor: "var(--input-border)",
							color: "var(--text-secondary)",
						}}
					>
						<SelectValue placeholder="Kind: Tümü" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Kind: Tümü</SelectItem>
						<SelectItem value="Pod">Pod</SelectItem>
						<SelectItem value="Deployment">Deployment</SelectItem>
						<SelectItem value="ReplicaSet">ReplicaSet</SelectItem>
						<SelectItem value="Node">Node</SelectItem>
					</SelectContent>
				</Select>
				<button
					onClick={() => refetchEvents()}
					disabled={eventsLoading}
					className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs border ml-auto"
					style={{
						borderColor: "var(--status-warn-border)",
						color: "var(--status-warn-text)",
					}}
				>
					{eventsLoading ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<RefreshCw className="w-3.5 h-3.5" />
					)}
					Yenile
				</button>
			</div>

			<p
				className="text-[10px] uppercase tracking-wider"
				style={{ color: "var(--text-muted)" }}
			>
				{filteredEvents.length} event
				{warningCount > 0 && (
					<span className="ml-2" style={{ color: "var(--status-warn-text)" }}>
						⚠ {warningCount} uyarı
					</span>
				)}
			</p>

			{eventsLoading && allEvents.length === 0 ? (
				<div
					className="flex items-center gap-2 py-6"
					style={{ color: "var(--text-faint)" }}
				>
					<Loader2 className="w-4 h-4 animate-spin" />
					<span className="text-xs">Event'ler yükleniyor...</span>
				</div>
			) : filteredEvents.length === 0 ? (
				<Card
					className="p-8 rounded-xl text-center"
					style={{
						background: "var(--surface-glass)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Bell
						className="w-8 h-8 mx-auto mb-2 opacity-30"
						style={{ color: "var(--text-faint)" }}
					/>
					<p className="text-xs" style={{ color: "var(--text-muted)" }}>
						Event bulunamadı
					</p>
				</Card>
			) : (
				<div className="space-y-1.5">
					{filteredEvents.map((ev: EventInfo, i: number) => (
						<motion.div
							key={ev.name + i}
							initial={{ opacity: 0, x: -4 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: Math.min(i * 0.02, 0.3) }}
						>
							<Card
								className="px-4 py-3 rounded-xl"
								style={{
									background: "var(--surface-glass)",
									border: `1px solid ${ev.type === "Warning" ? "var(--status-warn-border)" : "var(--border-subtle)"}`,
								}}
							>
								<div className="flex items-start gap-3">
									<div className="mt-0.5 shrink-0">
										{ev.type === "Warning" ? (
											<AlertTriangle
												className="w-3.5 h-3.5"
												style={{ color: "var(--status-warn)" }}
											/>
										) : (
											<Activity
												className="w-3.5 h-3.5"
												style={{ color: "var(--status-up)" }}
											/>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span
												className="text-xs font-semibold"
												style={{
													color:
														ev.type === "Warning"
															? "var(--status-warn-text)"
															: "var(--text-secondary)",
												}}
											>
												{ev.reason}
											</span>
											<span
												className="text-[10px] px-1.5 py-0.5 rounded-md"
												style={{
													background: "var(--surface-sunken)",
													color: "var(--text-faint)",
												}}
											>
												{ev.kind}/{ev.object}
											</span>
											{ev.count > 1 && (
												<span
													className="text-[9px] px-1.5 py-0.5 rounded-full"
													style={{
														background:
															"color-mix(in srgb, var(--status-warn) 12%, transparent)",
														color: "var(--status-warn-text)",
													}}
												>
													×{ev.count}
												</span>
											)}
										</div>
										<p
											className="text-[10px] mt-1 leading-relaxed"
											style={{ color: "var(--text-muted)" }}
										>
											{ev.message}
										</p>
									</div>
									{ev.age && (
										<span
											className="text-[10px] shrink-0"
											style={{ color: "var(--text-faint)" }}
										>
											{ev.age}
										</span>
									)}
								</div>
							</Card>
						</motion.div>
					))}
				</div>
			)}
		</motion.div>
	);
}
