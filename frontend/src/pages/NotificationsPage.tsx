import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AtSign,
	Bell,
	CheckCircle2,
	Hash,
	Loader2,
	MessageSquare,
	Plus,
	Send,
	Trash2,
	Webhook,
	XCircle,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type CreateChannelInput,
	type DeliveryRecord,
	type NotificationChannel,
	type NotificationChannelType,
	notificationsApi,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	SkeletonList,
} from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";

const CHANNEL_META: Record<
	NotificationChannelType,
	{ label: string; icon: typeof Bell; color: string; help: string }
> = {
	slack: {
		label: "Slack",
		icon: Hash,
		color: "#4a154b",
		help: "Slack incoming webhook URL — Workspace Settings → Integrations.",
	},
	discord: {
		label: "Discord",
		icon: MessageSquare,
		color: "#5865f2",
		help: "Discord channel webhook URL — Channel Settings → Integrations → Webhooks.",
	},
	webhook: {
		label: "Webhook",
		icon: Webhook,
		color: "#22d3ee",
		help: "Generic JSON POST endpoint. Optional shared secret signs the body with HMAC-SHA256.",
	},
	email: {
		label: "Email",
		icon: AtSign,
		color: "#818cf8",
		help: "Tek bir e-posta adresine alert gönderir (SMTP yapılandırılmış olmalı).",
	},
	pagerduty: {
		label: "PagerDuty",
		icon: Zap,
		color: "#06ac38",
		help: "PagerDuty Events API v2 routing key.",
	},
};

const SEV_LIST = [
	{ key: "info", label: "Info" },
	{ key: "warn", label: "Warn" },
	{ key: "crit", label: "Crit" },
] as const;

export function NotificationsPage() {
	const qc = useQueryClient();
	const [draft, setDraft] = useState<CreateChannelInput | null>(null);
	const [openDeliveriesFor, setOpenDeliveriesFor] = useState<string | null>(
		null,
	);

	const { data, isLoading } = useQuery({
		queryKey: ["notification-channels"],
		queryFn: notificationsApi.list,
	});

	const createMut = useMutation({
		mutationFn: notificationsApi.create,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notification-channels"] });
			setDraft(null);
			toast.success("Kanal eklendi");
		},
		onError: () => toast.error("Kanal eklenemedi"),
	});

	const deleteMut = useMutation({
		mutationFn: notificationsApi.remove,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notification-channels"] });
			toast.success("Kanal silindi");
		},
		onError: () => toast.error("Kanal silinemedi"),
	});

	const testMut = useMutation({
		mutationFn: notificationsApi.test,
		onSuccess: () => toast.success("Test bildirimi gönderildi"),
		onError: (e: Error) => toast.error(`Test başarısız: ${e.message}`),
	});

	const toggleMut = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			notificationsApi.update(id, { enabled }),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["notification-channels"] }),
	});

	const channels = data ?? [];

	return (
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="bildirimler"
				title="Bildirim Kanalları"
				description="Slack, Discord, webhook, e-posta ve PagerDuty üzerinden alert dağıtımı yapılandır."
				actions={
					<Button
						size="sm"
						onClick={() =>
							setDraft({
								name: "",
								type: "slack",
								config: { url: "" },
								severities: ["warn", "crit"],
								service_ids: [],
								cooldown_sec: 300,
								enabled: true,
							})
						}
						className="h-8 px-3 text-xs text-white"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						<Plus className="w-3.5 h-3.5 mr-1.5" /> Kanal Ekle
					</Button>
				}
			/>

			{draft && (
				<DraftEditor
					value={draft}
					onChange={setDraft}
					onCancel={() => setDraft(null)}
					onSubmit={() => createMut.mutate(draft)}
					submitting={createMut.isPending}
				/>
			)}

			<div className="flex flex-col gap-3 mt-4">
				{isLoading ? (
					<SkeletonList rows={3} rowHeight={68} />
				) : channels.length === 0 ? (
					<SharedEmptyState
						icon={Bell}
						title="Henüz bildirim kanalı yok"
						description="Slack, Discord, webhook, e-posta veya PagerDuty üzerinden alert almak için bir kanal ekle."
						tone="accent"
						size="lg"
						action={
							<Button
								size="sm"
								className="h-8 px-3 text-xs text-white"
								style={{ background: "var(--gradient-btn-primary)" }}
								onClick={() =>
									setDraft({
										name: "",
										type: "slack",
										config: { url: "" },
										severities: ["warn", "crit"],
										service_ids: [],
										cooldown_sec: 300,
										enabled: true,
									})
								}
							>
								<Plus className="w-3.5 h-3.5 mr-1.5" /> Kanal Ekle
							</Button>
						}
					/>
				) : (
					channels.map((ch) => (
						<ChannelRow
							key={ch.id}
							channel={ch}
							onTest={() => testMut.mutate(ch.id)}
							onDelete={() => deleteMut.mutate(ch.id)}
							onToggle={(enabled) =>
								toggleMut.mutate({ id: ch.id, enabled })
							}
							onOpenDeliveries={() =>
								setOpenDeliveriesFor(
									openDeliveriesFor === ch.id ? null : ch.id,
								)
							}
							deliveriesOpen={openDeliveriesFor === ch.id}
						/>
					))
				)}
			</div>
		</PageShell>
	);
}

function ChannelRow({
	channel,
	onTest,
	onDelete,
	onToggle,
	onOpenDeliveries,
	deliveriesOpen,
}: {
	channel: NotificationChannel;
	onTest: () => void;
	onDelete: () => void;
	onToggle: (v: boolean) => void;
	onOpenDeliveries: () => void;
	deliveriesOpen: boolean;
}) {
	const meta = CHANNEL_META[channel.type];
	const Icon = meta.icon;

	return (
		<Panel className="overflow-hidden">
			<div className="flex flex-wrap items-center gap-3 px-4 py-3">
				<span
					className="w-9 h-9 rounded flex items-center justify-center shrink-0"
					style={{
						background: `${meta.color}14`,
						border: `1px solid ${meta.color}33`,
					}}
				>
					<Icon className="w-4 h-4" style={{ color: meta.color }} />
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p
							className="text-sm font-bold truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{channel.name}
						</p>
						<span
							className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
							style={{
								color: meta.color,
								background: `${meta.color}14`,
								border: `1px solid ${meta.color}33`,
							}}
						>
							{meta.label}
						</span>
						{channel.last_error && (
							<span
								className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
								style={{
									color: "var(--status-down-text)",
									background: "var(--status-down-subtle)",
									border: "1px solid var(--status-down-border)",
								}}
								title={channel.last_error}
							>
								last error
							</span>
						)}
					</div>
					<p
						className="text-[10px] font-mono mt-0.5 truncate"
						style={{ color: "var(--text-muted)" }}
					>
						{channel.severities.join(", ")} ·{" "}
						{channel.cooldown_sec}s cooldown ·{" "}
						{channel.service_ids.length === 0
							? "tüm servisler"
							: `${channel.service_ids.length} servis`}
					</p>
				</div>

				<Switch
					checked={channel.enabled}
					onCheckedChange={onToggle}
					aria-label="enable"
				/>

				<Button
					size="sm"
					variant="outline"
					className="h-8 px-2 text-xs"
					onClick={onTest}
				>
					<Send className="w-3 h-3 mr-1" /> Test
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="h-8 px-2 text-xs"
					onClick={onOpenDeliveries}
				>
					Geçmiş
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0"
					onClick={onDelete}
					aria-label="sil"
				>
					<Trash2
						className="w-3.5 h-3.5"
						style={{ color: "var(--status-down)" }}
					/>
				</Button>
			</div>

			{deliveriesOpen && <DeliveriesPanel channelId={channel.id} />}
		</Panel>
	);
}

function DeliveriesPanel({ channelId }: { channelId: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ["notification-deliveries", channelId],
		queryFn: () => notificationsApi.deliveries(channelId, 30),
		refetchInterval: 10000,
	});

	if (isLoading) {
		return (
			<div className="px-4 py-3 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
				Yükleniyor…
			</div>
		);
	}
	const items = data ?? [];
	if (items.length === 0) {
		return (
			<div
				className="px-4 py-3 text-[11px] font-mono"
				style={{
					color: "var(--text-muted)",
					borderTop: "1px solid var(--border-subtle)",
					background: "var(--surface-sunken)",
				}}
			>
				Henüz gönderim yok.
			</div>
		);
	}

	return (
		<div
			className="px-4 py-3 flex flex-col gap-1.5"
			style={{
				borderTop: "1px solid var(--border-subtle)",
				background: "var(--surface-sunken)",
			}}
		>
			{items.map((d) => (
				<DeliveryRow key={d.id} d={d} />
			))}
		</div>
	);
}

function DeliveryRow({ d }: { d: DeliveryRecord }) {
	const isOK = d.status === "success";
	const isSkip = d.status.startsWith("skipped");
	const color = isOK
		? "var(--status-up-text)"
		: isSkip
			? "var(--text-faint)"
			: "var(--status-down-text)";
	return (
		<div className="flex items-center gap-2 text-[11px] font-mono">
			{isOK ? (
				<CheckCircle2
					className="w-3 h-3 shrink-0"
					style={{ color: "var(--status-up)" }}
				/>
			) : isSkip ? (
				<span
					className="w-3 h-3 shrink-0 rounded-full"
					style={{ background: "var(--text-faint)" }}
				/>
			) : (
				<XCircle
					className="w-3 h-3 shrink-0"
					style={{ color: "var(--status-down)" }}
				/>
			)}
			<span
				className="uppercase tracking-wider font-bold"
				style={{ color }}
			>
				{d.status}
			</span>
			{d.http_status != null && (
				<span style={{ color: "var(--text-muted)" }}>
					HTTP {d.http_status}
				</span>
			)}
			{d.duration_ms != null && (
				<span style={{ color: "var(--text-faint)" }}>
					{d.duration_ms}ms
				</span>
			)}
			<span className="ml-auto" style={{ color: "var(--text-faint)" }}>
				{new Date(d.created_at).toLocaleString("tr-TR", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})}
			</span>
			{d.error && (
				<span
					className="truncate max-w-[200px]"
					style={{ color: "var(--status-down-text)" }}
					title={d.error}
				>
					· {d.error}
				</span>
			)}
		</div>
	);
}

function DraftEditor({
	value,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: CreateChannelInput;
	onChange: (v: CreateChannelInput) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	const meta = CHANNEL_META[value.type];

	return (
		<Panel className="mt-4">
			<PanelHeader
				dense
				icon={<Bell className="w-3.5 h-3.5" style={{ color: "var(--color-teal)" }} />}
				actions={
					<button
						type="button"
						onClick={onCancel}
						className="text-[11px]"
						style={{ color: "var(--text-muted)" }}
					>
						İptal
					</button>
				}
			>
				Yeni Bildirim Kanalı
			</PanelHeader>
			<PanelBody scroll={false} className="flex flex-col gap-4">

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Ad
					</Label>
					<Input
						value={value.name}
						onChange={(e) => onChange({ ...value, name: e.target.value })}
						placeholder="prod-alerts"
						className="mt-1.5 h-9 text-sm"
					/>
				</div>
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Tip
					</Label>
					<div className="grid grid-cols-5 gap-1 mt-1.5">
						{(Object.keys(CHANNEL_META) as NotificationChannelType[]).map(
							(t) => {
								const m = CHANNEL_META[t];
								const I = m.icon;
								const active = value.type === t;
								return (
									<button
										key={t}
										type="button"
										onClick={() =>
											onChange({
												...value,
												type: t,
												config: defaultConfigFor(t),
											})
										}
										className="h-9 rounded flex items-center justify-center transition-colors"
										style={{
											background: active
												? `${m.color}1f`
												: "var(--surface-sunken)",
											border: `1px solid ${active ? m.color : "var(--border-default)"}`,
										}}
										title={m.label}
									>
										<I
											className="w-4 h-4"
											style={{ color: active ? m.color : "var(--text-muted)" }}
										/>
									</button>
								);
							},
						)}
					</div>
				</div>
			</div>

			<ConfigEditor
				type={value.type}
				config={value.config}
				onChange={(config) => onChange({ ...value, config })}
			/>

			<p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
				{meta.help}
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Şiddet Filtresi
					</Label>
					<div className="flex gap-1 mt-1.5">
						{SEV_LIST.map((s) => {
							const on = (value.severities ?? []).includes(s.key);
							return (
								<button
									key={s.key}
									type="button"
									className="h-8 px-3 rounded text-[11px] font-bold uppercase tracking-wider transition-colors"
									style={{
										background: on
											? "var(--color-teal-subtle)"
											: "var(--surface-sunken)",
										color: on
											? "var(--color-teal)"
											: "var(--text-muted)",
										border: `1px solid ${on ? "var(--color-teal-border)" : "var(--border-default)"}`,
									}}
									onClick={() => {
										const cur = new Set(value.severities ?? []);
										if (on) cur.delete(s.key);
										else cur.add(s.key);
										onChange({ ...value, severities: Array.from(cur) as NonNullable<typeof value.severities> });
									}}
								>
									{s.label}
								</button>
							);
						})}
					</div>
				</div>

				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						Cooldown (sn)
					</Label>
					<Input
						type="number"
						min={0}
						max={86400}
						value={value.cooldown_sec ?? 300}
						onChange={(e) =>
							onChange({
								...value,
								cooldown_sec: Number(e.target.value) || 0,
							})
						}
						className="mt-1.5 h-9 text-sm font-mono tabular-nums"
					/>
				</div>
			</div>

			</PanelBody>
			<PanelFooter>
				<Button
					variant="outline"
					size="sm"
					className="h-8 px-3 text-xs"
					onClick={onCancel}
				>
					Vazgeç
				</Button>
				<Button
					size="sm"
					className="h-8 px-3 text-xs text-white"
					style={{ background: "var(--gradient-btn-primary)" }}
					disabled={submitting || !value.name.trim()}
					onClick={onSubmit}
				>
					{submitting ? (
						<Loader2 className="w-3 h-3 mr-1 animate-spin" />
					) : (
						<Plus className="w-3 h-3 mr-1" />
					)}
					Ekle
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function ConfigEditor({
	type,
	config,
	onChange,
}: {
	type: NotificationChannelType;
	config: Record<string, unknown>;
	onChange: (v: Record<string, unknown>) => void;
}) {
	if (type === "email") {
		return (
			<div>
				<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
					E-posta Adresi
				</Label>
				<Input
					type="email"
					placeholder="alerts@example.com"
					value={(config.to as string) ?? ""}
					onChange={(e) => onChange({ ...config, to: e.target.value })}
					className="mt-1.5 h-9 text-sm"
				/>
			</div>
		);
	}
	if (type === "pagerduty") {
		return (
			<div>
				<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
					Routing Key
				</Label>
				<Input
					placeholder="R0AB1234567890ABCDEF12"
					value={(config.routing_key as string) ?? ""}
					onChange={(e) =>
						onChange({ ...config, routing_key: e.target.value })
					}
					className="mt-1.5 h-9 text-sm font-mono"
				/>
			</div>
		);
	}
	return (
		<div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
			<div>
				<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
					URL
				</Label>
				<Input
					placeholder="https://hooks.slack.com/services/..."
					value={(config.url as string) ?? ""}
					onChange={(e) => onChange({ ...config, url: e.target.value })}
					className="mt-1.5 h-9 text-sm font-mono"
				/>
			</div>
			{type === "webhook" && (
				<div>
					<Label className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "var(--text-faint)" }}>
						HMAC Secret (opsiyonel)
					</Label>
					<Input
						placeholder="rastgele-uzun-string"
						value={(config.secret as string) ?? ""}
						onChange={(e) =>
							onChange({ ...config, secret: e.target.value })
						}
						className="mt-1.5 h-9 text-sm font-mono"
					/>
				</div>
			)}
		</div>
	);
}

function defaultConfigFor(t: NotificationChannelType): Record<string, unknown> {
	switch (t) {
		case "email":
			return { to: "" };
		case "pagerduty":
			return { routing_key: "" };
		default:
			return { url: "" };
	}
}


