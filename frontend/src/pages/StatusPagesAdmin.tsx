import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Globe,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type CreateStatusPageInput,
	type StatusPage,
	statusPageApi,
} from "@/api/statuspage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";
import { useServices } from "@/hooks/useServices";

export function StatusPagesAdmin() {
	const qc = useQueryClient();
	const { services } = useServices();
	const [draft, setDraft] = useState<CreateStatusPageInput | null>(null);

	const { data: pages = [], isLoading } = useQuery({
		queryKey: ["status-pages"],
		queryFn: statusPageApi.list,
	});

	const createMut = useMutation({
		mutationFn: statusPageApi.create,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["status-pages"] });
			setDraft(null);
			toast.success("Status sayfası oluşturuldu");
		},
		onError: (e: unknown) => {
			const msg =
				(e as { response?: { data?: { message?: string } } })?.response?.data
					?.message ?? "Oluşturulamadı";
			toast.error(msg);
		},
	});

	const updateMut = useMutation({
		mutationFn: ({
			id,
			patch,
		}: {
			id: string;
			patch: Partial<CreateStatusPageInput>;
		}) => statusPageApi.update(id, patch),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["status-pages"] }),
	});

	const deleteMut = useMutation({
		mutationFn: statusPageApi.remove,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["status-pages"] });
			toast.success("Silindi");
		},
	});

	return (
		<PageShell width="wide">
			<PageHeader
				eyebrow="herkese açık"
				title="Status Sayfaları"
				description="Servislerinizin canlı durumunu paylaşmak için herkese açık (auth gerektirmeyen) sayfalar yayınlayın."
				actions={
					<Button
						size="sm"
						onClick={() =>
							setDraft({
								slug: "",
								title: "",
								description: "",
								service_ids: [],
								enabled: true,
							})
						}
						className="h-8 px-3 text-xs text-white"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						<Plus className="w-3.5 h-3.5 mr-1.5" /> Yeni Sayfa
					</Button>
				}
			/>

			{draft && (
				<DraftEditor
					value={draft}
					services={services.map((s) => ({ id: s.id, name: s.name }))}
					onChange={setDraft}
					onCancel={() => setDraft(null)}
					onSubmit={() => createMut.mutate(draft)}
					submitting={createMut.isPending}
				/>
			)}

			<div className="flex flex-col gap-3 mt-4">
				{isLoading ? (
					<div className="space-y-3">
						{[0, 1].map((i) => (
							<div
								key={i}
								className="h-24 rounded-lg animate-pulse"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							/>
						))}
					</div>
				) : pages.length === 0 ? (
					<EmptyState />
				) : (
					pages.map((p) => (
						<PageRow
							key={p.id}
							page={p}
							onToggle={(enabled) =>
								updateMut.mutate({ id: p.id, patch: { enabled } })
							}
							onDelete={() => deleteMut.mutate(p.id)}
						/>
					))
				)}
			</div>
		</PageShell>
	);
}

function PageRow({
	page,
	onToggle,
	onDelete,
}: {
	page: StatusPage;
	onToggle: (enabled: boolean) => void;
	onDelete: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const url = `${window.location.origin}/status/${page.slug}`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Panoya kopyalanamadı");
		}
	};

	return (
		<div
			className="rounded-lg p-4 flex items-start justify-between gap-4"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				opacity: page.enabled ? 1 : 0.65,
			}}
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<Globe className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
					<p
						className="text-sm font-bold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{page.title}
					</p>
					{!page.enabled && (
						<span
							className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
							style={{
								color: "var(--text-faint)",
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-default)",
							}}
						>
							pasif
						</span>
					)}
				</div>
				<div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
					<code
						className="px-2 py-0.5 rounded truncate max-w-md"
						style={{
							background: "var(--surface-sunken)",
							color: "var(--text-secondary)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{url}
					</code>
					<button
						type="button"
						onClick={copy}
						className="h-6 w-6 flex items-center justify-center rounded transition-colors"
						style={{ color: "var(--text-muted)" }}
						aria-label="URL kopyala"
					>
						{copied ? (
							<Check
								className="w-3.5 h-3.5"
								style={{ color: "var(--status-up)" }}
							/>
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
					</button>
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="h-6 w-6 flex items-center justify-center rounded"
						style={{ color: "var(--text-muted)" }}
						aria-label="Sayfayı aç"
					>
						<ExternalLink className="w-3.5 h-3.5" />
					</a>
				</div>
				{page.description && (
					<p
						className="mt-2 text-xs leading-relaxed"
						style={{ color: "var(--text-muted)" }}
					>
						{page.description}
					</p>
				)}
				<p
					className="mt-2 text-[10px] font-mono uppercase tracking-wider"
					style={{ color: "var(--text-faint)" }}
				>
					{page.service_ids.length} servis
				</p>
			</div>

			<div className="flex items-center gap-1 shrink-0">
				<Button
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0"
					onClick={() => onToggle(!page.enabled)}
					aria-label={page.enabled ? "Yayını durdur" : "Yayına al"}
				>
					{page.enabled ? (
						<Eye
							className="w-3.5 h-3.5"
							style={{ color: "var(--color-teal)" }}
						/>
					) : (
						<EyeOff
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-faint)" }}
						/>
					)}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0"
					onClick={onDelete}
					aria-label="Sil"
				>
					<Trash2
						className="w-3.5 h-3.5"
						style={{ color: "var(--status-down)" }}
					/>
				</Button>
			</div>
		</div>
	);
}

function DraftEditor({
	value,
	services,
	onChange,
	onCancel,
	onSubmit,
	submitting,
}: {
	value: CreateStatusPageInput;
	services: { id: string; name: string }[];
	onChange: (v: CreateStatusPageInput) => void;
	onCancel: () => void;
	onSubmit: () => void;
	submitting: boolean;
}) {
	const toggleService = (id: string) => {
		const set = new Set(value.service_ids);
		if (set.has(id)) set.delete(id);
		else set.add(id);
		onChange({ ...value, service_ids: Array.from(set) });
	};
	const slugValid = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value.slug);

	return (
		<div
			className="mt-4 p-5 rounded-lg flex flex-col gap-4"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-strong)",
			}}
		>
			<p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
				Yeni Status Sayfası
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<Label
						className="text-[10px] uppercase tracking-[0.2em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Başlık
					</Label>
					<Input
						value={value.title}
						onChange={(e) => onChange({ ...value, title: e.target.value })}
						placeholder="Acme Status"
						className="mt-1.5 h-9 text-sm"
					/>
				</div>
				<div>
					<Label
						className="text-[10px] uppercase tracking-[0.2em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Slug (URL)
					</Label>
					<Input
						value={value.slug}
						onChange={(e) =>
							onChange({ ...value, slug: e.target.value.toLowerCase() })
						}
						placeholder="acme"
						className="mt-1.5 h-9 text-sm font-mono"
					/>
					{!slugValid && value.slug.length > 0 && (
						<p
							className="mt-1 text-[10px] font-mono"
							style={{ color: "var(--status-down-text)" }}
						>
							3-64 karakter, küçük harf/rakam/tire, baş ve sonu harf/rakam.
						</p>
					)}
				</div>
			</div>

			<div>
				<Label
					className="text-[10px] uppercase tracking-[0.2em] font-bold"
					style={{ color: "var(--text-faint)" }}
				>
					Açıklama (opsiyonel)
				</Label>
				<Textarea
					value={value.description ?? ""}
					onChange={(e) =>
						onChange({ ...value, description: e.target.value })
					}
					placeholder="Müşterilerinize gösterilecek kısa açıklama"
					className="mt-1.5 text-sm min-h-[80px]"
				/>
			</div>

			<div>
				<Label
					className="text-[10px] uppercase tracking-[0.2em] font-bold"
					style={{ color: "var(--text-faint)" }}
				>
					Servisler ({value.service_ids.length} seçili)
				</Label>
				<div
					className="mt-1.5 max-h-56 overflow-y-auto rounded p-1"
					style={{
						background: "var(--input-bg)",
						border: "1px solid var(--input-border)",
					}}
				>
					{services.length === 0 ? (
						<p
							className="text-xs p-3 text-center"
							style={{ color: "var(--text-muted)" }}
						>
							Henüz servis tanımlı değil.
						</p>
					) : (
						services.map((s) => {
							const checked = value.service_ids.includes(s.id);
							return (
								<button
									type="button"
									key={s.id}
									onClick={() => toggleService(s.id)}
									className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-left transition-colors text-sm hover:bg-[var(--surface-sunken)]"
									style={{
										color: "var(--text-primary)",
									}}
								>
									<span className="truncate">{s.name}</span>
									{checked ? (
										<Check
											className="w-4 h-4 shrink-0"
											style={{ color: "var(--color-teal)" }}
										/>
									) : (
										<span
											className="w-4 h-4 rounded shrink-0"
											style={{ border: "1px solid var(--border-default)" }}
										/>
									)}
								</button>
							);
						})
					)}
				</div>
			</div>

			<div className="flex items-center justify-end gap-2">
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
					disabled={
						submitting ||
						!value.title.trim() ||
						!slugValid ||
						value.service_ids.length === 0
					}
					onClick={onSubmit}
				>
					{submitting ? (
						<Loader2 className="w-3 h-3 mr-1 animate-spin" />
					) : (
						<Plus className="w-3 h-3 mr-1" />
					)}
					Yayınla
				</Button>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div
			className="flex flex-col items-center justify-center p-12 rounded-lg text-center"
			style={{
				background: "var(--surface-card)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Globe className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
			</span>
			<p
				className="text-sm font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				Henüz status sayfası yok
			</p>
			<p
				className="text-xs leading-relaxed max-w-sm"
				style={{ color: "var(--text-muted)" }}
			>
				Müşterileriniz veya ekip arkadaşlarınız için herkese açık bir
				durum sayfası yayınlayın.
			</p>
		</div>
	);
}
