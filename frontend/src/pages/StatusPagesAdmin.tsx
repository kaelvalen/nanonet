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
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	EmptyState as SharedEmptyState,
	SkeletonList,
} from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/textarea";
import { useServices } from "@/hooks/useServices";

const EMPTY_DRAFT: CreateStatusPageInput = {
	slug: "",
	title: "",
	description: "",
	service_ids: [],
	enabled: true,
};

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
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="Herkese açık"
				title="Status sayfaları"
				description="Servislerinizin canlı durumunu paylaşmak için herkese açık (auth gerektirmeyen) sayfalar yayınlayın."
				actions={
					<Button size="sm" onClick={() => setDraft(EMPTY_DRAFT)}>
						<Plus className="w-3.5 h-3.5 mr-1.5" /> Yeni sayfa
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

			<div className="flex flex-col gap-2 mt-4">
				{isLoading ? (
					<SkeletonList rows={2} rowHeight={96} />
				) : pages.length === 0 ? (
					<SharedEmptyState
						icon={Globe}
						title="Henüz status sayfası yok"
						description="Müşterileriniz veya ekip arkadaşlarınız için herkese açık bir durum sayfası yayınlayın."
						tone="accent"
						size="lg"
					/>
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
			className="relative rounded-[6px] px-4 py-3.5"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
				opacity: page.enabled ? 1 : 0.6,
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{
					background: page.enabled
						? "var(--brand-primary)"
						: "var(--border-strong)",
				}}
			/>
			<div className="flex flex-col sm:flex-row items-start justify-between gap-4 pl-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<span
							className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<Globe
								className="w-4 h-4"
								style={{ color: "var(--text-secondary)" }}
							/>
						</span>
						<p
							className="text-[14px] font-semibold truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{page.title}
						</p>
						{!page.enabled && (
							<span
								className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
								style={{
									color: "var(--text-tertiary)",
									background: "var(--surface-sunken)",
								}}
							>
								Pasif
							</span>
						)}
					</div>
					<div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-mono">
						<code
							className="px-2 py-1 rounded-[4px] truncate max-w-md"
							style={{
								background: "var(--surface-sunken)",
								color: "var(--text-secondary)",
							}}
						>
							{url}
						</code>
						<Button
							variant="ghost"
							size="icon"
							onClick={copy}
							aria-label="URL kopyala"
						>
							{copied ? (
								<Check
									className="w-3.5 h-3.5"
									style={{ color: "var(--status-up)" }}
								/>
							) : (
								<Copy
									className="w-3.5 h-3.5"
									style={{ color: "var(--text-tertiary)" }}
								/>
							)}
						</Button>
						<Button variant="ghost" size="icon" asChild aria-label="Sayfayı aç">
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								style={{ color: "var(--text-tertiary)" }}
							>
								<ExternalLink className="w-3.5 h-3.5" />
							</a>
						</Button>
					</div>
					{page.description && (
						<p
							className="mt-2.5 text-[13px] leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							{page.description}
						</p>
					)}
					<p
						className="mt-2 text-[11px] tnum"
						style={{ color: "var(--text-faint)" }}
					>
						{page.service_ids.length} servis
					</p>
				</div>

				<div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onToggle(!page.enabled)}
						aria-label={page.enabled ? "Yayını durdur" : "Yayına al"}
					>
						{page.enabled ? (
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
					</Button>
					<Button
						variant="ghost"
						size="icon"
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
		<Panel className="mt-4" padding="none">
			<PanelHeader dense>Yeni status sayfası</PanelHeader>
			<PanelBody scroll={false} className="flex flex-col gap-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<FieldLabel htmlFor="sp-title">Başlık</FieldLabel>
						<Input
							id="sp-title"
							value={value.title}
							onChange={(e) => onChange({ ...value, title: e.target.value })}
							placeholder="Acme Status"
							className="mt-1.5 h-9 text-[13px]"
						/>
					</div>
					<div>
						<FieldLabel htmlFor="sp-slug">Slug (URL)</FieldLabel>
						<Input
							id="sp-slug"
							value={value.slug}
							onChange={(e) =>
								onChange({ ...value, slug: e.target.value.toLowerCase() })
							}
							placeholder="acme"
							className="mt-1.5 h-9 text-[13px] font-mono"
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
					<FieldLabel htmlFor="sp-desc">Açıklama (opsiyonel)</FieldLabel>
					<Textarea
						id="sp-desc"
						value={value.description ?? ""}
						onChange={(e) =>
							onChange({ ...value, description: e.target.value })
						}
						placeholder="Müşterilerinize gösterilecek kısa açıklama"
						className="mt-1.5 text-[13px] min-h-[80px]"
					/>
				</div>

				<div>
					<FieldLabel>Servisler ({value.service_ids.length} seçili)</FieldLabel>
					<div
						className="mt-1.5 max-h-56 overflow-y-auto rounded-[6px] p-1"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{services.length === 0 ? (
							<p
								className="text-[13px] p-3 text-center"
								style={{ color: "var(--text-tertiary)" }}
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
										aria-pressed={checked}
										className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[4px] text-left transition-colors text-[13px] hover:bg-[var(--surface-base)]"
										style={{ color: "var(--text-primary)" }}
									>
										<span className="truncate">{s.name}</span>
										{checked ? (
											<Check
												className="w-4 h-4 shrink-0"
												style={{ color: "var(--brand-primary)" }}
											/>
										) : (
											<span
												className="w-4 h-4 rounded-[3px] shrink-0"
												style={{ border: "1px solid var(--border-default)" }}
											/>
										)}
									</button>
								);
							})
						)}
					</div>
				</div>
			</PanelBody>
			<PanelFooter>
				<Button variant="outline" size="sm" onClick={onCancel}>
					Vazgeç
				</Button>
				<Button
					size="sm"
					disabled={
						submitting ||
						!value.title.trim() ||
						!slugValid ||
						value.service_ids.length === 0
					}
					onClick={onSubmit}
				>
					{submitting ? (
						<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
					) : (
						<Plus className="w-3.5 h-3.5 mr-1.5" />
					)}
					Yayınla
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function FieldLabel({
	children,
	htmlFor,
}: {
	children: React.ReactNode;
	htmlFor?: string;
}) {
	return (
		<Label
			htmlFor={htmlFor}
			className="text-[11px] font-medium uppercase tracking-wider"
			style={{ color: "var(--text-faint)" }}
		>
			{children}
		</Label>
	);
}
