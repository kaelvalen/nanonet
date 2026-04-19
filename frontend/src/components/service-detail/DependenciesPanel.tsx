import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dependenciesApi, type ServiceDependency } from "@/api/dependencies";

export function DependenciesPanel({ serviceId }: { serviceId: string }) {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["service-dependencies", serviceId],
		queryFn: () => dependenciesApi.list(serviceId),
		refetchInterval: 30_000,
		enabled: !!serviceId,
	});

	const promote = useMutation({
		mutationFn: ({ id, promoted }: { id: string; promoted: boolean }) =>
			dependenciesApi.promote(serviceId, id, promoted),
		onSuccess: (_d, vars) => {
			toast.success(
				vars.promoted ? "Servis haritasına eklendi" : "Haritadan kaldırıldı",
			);
			qc.invalidateQueries({ queryKey: ["service-dependencies", serviceId] });
		},
		onError: () => toast.error("İşlem başarısız"),
	});

	const remove = useMutation({
		mutationFn: (id: string) => dependenciesApi.remove(serviceId, id),
		onSuccess: () => {
			toast.success("Bağımlılık silindi");
			qc.invalidateQueries({ queryKey: ["service-dependencies", serviceId] });
		},
		onError: () => toast.error("Silme başarısız"),
	});

	const items = data ?? [];

	return (
		<div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
			<div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
				<div className="flex items-center gap-2">
					<GitBranch className="h-4 w-4 text-white/60" />
					<div>
						<div className="text-[13px] font-semibold text-white">
							Otomatik Bağımlılıklar
						</div>
						<div className="text-[11px] text-white/50">
							Agent'ın gözlemlediği outbound TCP hedefleri (her 60s)
						</div>
					</div>
				</div>
				<span className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/60 tabular-nums">
					{items.length}
				</span>
			</div>

			<div className="px-4 py-3">
				{isLoading ? (
					<div className="flex items-center justify-center py-8 text-white/50">
						<Loader2 className="h-4 w-4 animate-spin" />
					</div>
				) : items.length === 0 ? (
					<EmptyState />
				) : (
					<div className="overflow-hidden rounded-md border border-white/[0.06]">
						<table className="w-full text-[12px]">
							<thead>
								<tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[10px] uppercase tracking-[0.2em] text-white/50">
									<th className="px-3 py-2 font-bold">Hedef</th>
									<th className="px-3 py-2 font-bold">Port</th>
									<th className="px-3 py-2 font-bold">Örnek</th>
									<th className="px-3 py-2 font-bold">Son Görülme</th>
									<th className="px-3 py-2 font-bold text-right">İşlem</th>
								</tr>
							</thead>
							<tbody>
								{items.map((d) => (
									<Row
										key={d.id}
										dep={d}
										busy={
											(promote.isPending && promote.variables?.id === d.id) ||
											(remove.isPending && remove.variables === d.id)
										}
										onPromote={(promoted) =>
											promote.mutate({ id: d.id, promoted })
										}
										onDelete={() => remove.mutate(d.id)}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

function Row({
	dep,
	busy,
	onPromote,
	onDelete,
}: {
	dep: ServiceDependency;
	busy: boolean;
	onPromote: (promoted: boolean) => void;
	onDelete: () => void;
}) {
	return (
		<tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]">
			<td className="px-3 py-2">
				<div className="flex items-center gap-2">
					{dep.promoted && <Pin className="h-3 w-3 text-emerald-400" />}
					<span className="font-mono text-white/90">{dep.target_host}</span>
				</div>
				{dep.process_name && (
					<div className="mt-0.5 font-mono text-[10px] text-white/40">
						{dep.process_name}
					</div>
				)}
			</td>
			<td className="px-3 py-2 font-mono text-white/70 tabular-nums">
				{dep.target_port}/{dep.protocol}
			</td>
			<td className="px-3 py-2 font-mono text-white/60 tabular-nums">
				{dep.sample_count}
			</td>
			<td className="px-3 py-2 text-white/60">{relative(dep.last_seen_at)}</td>
			<td className="px-3 py-2">
				<div className="flex items-center justify-end gap-1.5">
					<button
						type="button"
						disabled={busy}
						onClick={() => onPromote(!dep.promoted)}
						className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-white/80 hover:border-white/20 disabled:opacity-50"
						title={dep.promoted ? "Haritadan kaldır" : "Servis haritasına ekle"}
					>
						{dep.promoted ? (
							<PinOff className="h-3 w-3" />
						) : (
							<Pin className="h-3 w-3" />
						)}
						{dep.promoted ? "Kaldır" : "Ekle"}
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={onDelete}
						className="inline-flex items-center rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
						title="Sil"
					>
						<Trash2 className="h-3 w-3" />
					</button>
				</div>
			</td>
		</tr>
	);
}

function EmptyState() {
	return (
		<div className="rounded-md border border-dashed border-white/[0.08] py-8 text-center text-[12px] text-white/50">
			Henüz bağımlılık gözlemlenmedi. Agent en geç 60 saniyede bir tarama yapar.
		</div>
	);
}

function relative(iso: string): string {
	const t = new Date(iso).getTime();
	const diff = Math.max(0, Date.now() - t);
	const s = Math.floor(diff / 1000);
	if (s < 60) return `${s}s önce`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}d önce`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}sa önce`;
	return `${Math.floor(h / 24)}g önce`;
}
