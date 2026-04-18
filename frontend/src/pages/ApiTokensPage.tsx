import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle2,
	Copy,
	Key,
	Loader2,
	Plus,
	Trash2,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type CreateApiTokenInput, apiTokensApi } from "@/api/apiTokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	SkeletonList,
} from "@/components/ui/primitives";

const SCOPE_HELP: Record<string, string> = {
	"*": "Tüm yetkiler — yalnızca güvenilir entegrasyonlar için",
	"services:read": "Servis listesi ve detaylarını oku",
	"services:write": "Servis oluştur, güncelle, sil",
	"alerts:read": "Uyarıları listele ve detaylarını oku",
	"alerts:ack": "Uyarıları onayla / kapat",
	"metrics:read": "Servis metriklerini oku",
	"logs:read": "Servis loglarını oku",
	"incidents:read": "Incident'ları listele",
	"incidents:write": "Incident oluştur ve güncelle",
	"ai:read": "AI içgörülerini ve raporlarını oku",
	"slo:read": "SLO ve error budget verilerini oku",
};

export function ApiTokensPage() {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["api-tokens"],
		queryFn: apiTokensApi.list,
	});
	const [draft, setDraft] = useState<CreateApiTokenInput | null>(null);
	const [revealed, setRevealed] = useState<{
		secret: string;
		name: string;
	} | null>(null);

	const createMut = useMutation({
		mutationFn: apiTokensApi.create,
		onSuccess: (res) => {
			setRevealed({ secret: res.secret, name: res.token.name });
			setDraft(null);
			qc.invalidateQueries({ queryKey: ["api-tokens"] });
		},
		onError: (e: Error & { response?: { data?: { error?: string } } }) =>
			toast.error(e.response?.data?.error ?? "Token oluşturulamadı"),
	});

	const revokeMut = useMutation({
		mutationFn: apiTokensApi.revoke,
		onSuccess: () => {
			toast.success("Token iptal edildi");
			qc.invalidateQueries({ queryKey: ["api-tokens"] });
		},
		onError: () => toast.error("İptal başarısız"),
	});

	const tokens = data?.tokens ?? [];
	const scopes = data?.available_scopes ?? [];

	return (
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="Integrations"
				title="API Tokens"
				description="Programatik erişim için kişisel token'lar oluştur ve yönet"
				actions={
					<Button
						onClick={() =>
							setDraft({
								name: "",
								scopes: ["services:read"],
								expires_in_days: 0,
							})
						}
						className="gap-2 h-9 px-4 text-[13px] text-white rounded-full"
						size="sm"
						style={{ background: "var(--gradient-btn-primary)" }}
					>
						<Plus className="size-3.5" /> Yeni Token
					</Button>
				}
			/>

			{revealed && (
				<RevealedBanner
					name={revealed.name}
					secret={revealed.secret}
					onDismiss={() => setRevealed(null)}
				/>
			)}

			{draft && (
				<DraftEditor
					draft={draft}
					availableScopes={scopes}
					saving={createMut.isPending}
					onCancel={() => setDraft(null)}
					onSave={() => createMut.mutate(draft)}
					onChange={setDraft}
				/>
			)}

			<div className="mt-3">
				{isLoading ? (
					<SkeletonList rows={3} rowHeight={88} />
				) : tokens.length === 0 ? (
					<EmptyState
						icon={Key}
						title="Henüz API token oluşturulmadı"
						description='Yukarıdaki "Yeni Token" düğmesiyle ilkini oluştur.'
						tone="accent"
						size="lg"
					/>
				) : (
					<div className="space-y-2">
						{tokens.map((tok) => (
							<TokenRow
								key={tok.id}
								token={tok}
								onRevoke={() => {
									if (
										confirm(
											`"${tok.name}" tokenini iptal etmek istiyor musun? Bu işlem geri alınamaz.`,
										)
									) {
										revokeMut.mutate(tok.id);
									}
								}}
							/>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}

function RevealedBanner({
	name,
	secret,
	onDismiss,
}: {
	name: string;
	secret: string;
	onDismiss: () => void;
}) {
	return (
		<Panel tone="warn" className="mb-4 rounded-2xl">
			<div className="flex items-start gap-3 p-4">
				<span
					className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
					style={{ background: "var(--status-warn-subtle)" }}
				>
					<AlertTriangle
						className="size-4"
						style={{ color: "var(--status-warn)" }}
					/>
				</span>
				<div className="flex-1 min-w-0">
					<div
						className="text-[14px] font-semibold tracking-tight"
						style={{ color: "var(--status-warn-text)" }}
					>
						Token "{name}" oluşturuldu — şimdi kopyala
					</div>
					<div
						className="mt-1 text-[12px]"
						style={{ color: "var(--text-secondary)" }}
					>
						Bu secret değer bir daha gösterilmeyecek. Güvenli bir yere kaydet.
					</div>
					<div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
						<code
							className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[12px] font-mono break-all"
							style={{
								background: "var(--input-bg)",
								color: "var(--text-primary)",
								border: "1px solid var(--border-default)",
							}}
						>
							{secret}
						</code>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								className="gap-1 h-9 px-4 text-[13px] rounded-full"
								onClick={() => {
									navigator.clipboard.writeText(secret);
									toast.success("Token panoya kopyalandı");
								}}
							>
								<Copy className="size-3.5" /> Kopyala
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-9 px-4 text-[13px] rounded-full"
								onClick={onDismiss}
							>
								Tamam
							</Button>
						</div>
					</div>
				</div>
			</div>
		</Panel>
	);
}

function DraftEditor({
	draft,
	availableScopes,
	saving,
	onCancel,
	onSave,
	onChange,
}: {
	draft: CreateApiTokenInput;
	availableScopes: string[];
	saving: boolean;
	onCancel: () => void;
	onSave: () => void;
	onChange: (next: CreateApiTokenInput) => void;
}) {
	const toggleScope = (scope: string) => {
		const has = draft.scopes.includes(scope);
		onChange({
			...draft,
			scopes: has
				? draft.scopes.filter((s) => s !== scope)
				: [...draft.scopes, scope],
		});
	};
	return (
		<Panel className="mb-4 rounded-2xl">
			<PanelHeader dense>Yeni API Token</PanelHeader>
			<PanelBody scroll={false}>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label className="text-[12px] font-medium">İsim</Label>
						<Input
							className="mt-1.5 h-9 text-[13px] rounded-lg"
							placeholder="örn. CI deploy bot"
							value={draft.name}
							onChange={(e) => onChange({ ...draft, name: e.target.value })}
						/>
					</div>
					<div>
						<Label className="text-[12px] font-medium">Süre (gün)</Label>
						<Input
							className="mt-1.5 h-9 w-32 text-[13px] rounded-lg"
							type="number"
							min={0}
							max={3650}
							value={draft.expires_in_days ?? 0}
							onChange={(e) =>
								onChange({
									...draft,
									expires_in_days: parseInt(e.target.value, 10) || 0,
								})
							}
						/>
						<div
							className="mt-1.5 text-[11px]"
							style={{ color: "var(--text-faint)" }}
						>
							0 = süresiz
						</div>
					</div>
				</div>

				<div className="mt-4">
					<Label className="text-[12px] font-medium">Scope'lar</Label>
					<div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{availableScopes.map((scope) => {
							const checked = draft.scopes.includes(scope);
							return (
								<button
									key={scope}
									type="button"
									onClick={() => toggleScope(scope)}
									className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-all"
									style={{
										background: checked
											? "var(--color-violet-subtle)"
											: "var(--surface-sunken)",
										borderColor: checked
											? "var(--color-violet-border)"
											: "transparent",
									}}
								>
									{checked ? (
										<CheckCircle2
											className="mt-0.5 size-3.5 shrink-0"
											style={{ color: "var(--color-violet)" }}
										/>
									) : (
										<div
											className="mt-0.5 size-3.5 rounded-full border shrink-0"
											style={{ borderColor: "var(--text-faint)" }}
										/>
									)}
									<div className="flex-1 min-w-0">
										<div
											className="text-[12px] font-mono font-semibold truncate"
											style={{ color: "var(--text-primary)" }}
										>
											{scope}
										</div>
										<div
											className="text-[11px] mt-0.5 leading-relaxed"
											style={{ color: "var(--text-faint)" }}
										>
											{SCOPE_HELP[scope] ?? "—"}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			</PanelBody>
			<PanelFooter>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 px-4 text-[13px] rounded-full"
					onClick={onCancel}
				>
					İptal
				</Button>
				<Button
					size="sm"
					disabled={saving || !draft.name.trim() || draft.scopes.length === 0}
					onClick={onSave}
					className="text-white h-9 px-4 text-[13px] rounded-full"
					style={{ background: "var(--gradient-btn-primary)" }}
				>
					{saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
					Oluştur
				</Button>
			</PanelFooter>
		</Panel>
	);
}

function TokenRow({
	token,
	onRevoke,
}: {
	token: import("@/api/apiTokens").ApiToken;
	onRevoke: () => void;
}) {
	const lastUsed = useMemo(() => {
		if (!token.last_used_at) return "hiç";
		const m = Math.round(
			(Date.now() - new Date(token.last_used_at).getTime()) / 60_000,
		);
		if (m < 1) return "az önce";
		if (m < 60) return `${m}dk önce`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h}sa önce`;
		return new Date(token.last_used_at).toLocaleDateString();
	}, [token.last_used_at]);

	const expired = !!token.expires_at && new Date(token.expires_at) < new Date();
	const revoked = !!token.revoked_at;
	const dead = expired || revoked;

	return (
		<Panel padding="md" className="rounded-2xl" style={{ opacity: dead ? 0.55 : 1 }}>
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<span
							className="text-[14px] font-semibold truncate tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							{token.name}
						</span>
						{revoked && (
							<span
								className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
								style={{
									background: "var(--status-down-subtle)",
									color: "var(--status-down-text)",
								}}
							>
								<XCircle className="size-3" /> İptal
							</span>
						)}
						{!revoked && expired && (
							<span
								className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
								style={{
									background: "var(--status-warn-subtle)",
									color: "var(--status-warn-text)",
								}}
							>
								Süresi dolmuş
							</span>
						)}
					</div>
					<div
						className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
						style={{ color: "var(--text-faint)" }}
					>
						<code
							className="rounded-md px-2 py-0.5 font-mono"
							style={{ background: "var(--surface-sunken)" }}
						>
							{token.prefix}…
						</code>
						<span>son kullanım: {lastUsed}</span>
						{token.expires_at && (
							<span>
								sona erme: {new Date(token.expires_at).toLocaleDateString()}
							</span>
						)}
					</div>
					<div className="mt-2.5 flex flex-wrap gap-1.5">
						{token.scopes.map((s) => (
							<span
								key={s}
								className="rounded-full px-2 py-0.5 text-[11px] font-mono"
								style={{
									background: "var(--surface-sunken)",
									color: "var(--text-secondary)",
								}}
							>
								{s}
							</span>
						))}
					</div>
				</div>
				{!revoked && (
					<Button
						variant="ghost"
						size="sm"
						className="shrink-0 h-9 w-9 p-0 rounded-full"
						style={{ color: "var(--status-down)" }}
						onClick={onRevoke}
					>
						<Trash2 className="size-4" />
					</Button>
				)}
			</div>
		</Panel>
	);
}
