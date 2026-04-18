import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type GrantRole, grantsApi } from "@/api/grants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROLE_LABEL: Record<GrantRole, string> = {
	viewer: "Viewer (yalnızca okuma)",
	operator: "Operator (komut çalıştırabilir)",
	admin: "Admin (her şey, sahiplik hariç)",
};

export function SharingPanel({ serviceId }: { serviceId: string }) {
	const qc = useQueryClient();
	const { data: grants } = useQuery({
		queryKey: ["service-grants", serviceId],
		queryFn: () => grantsApi.list(serviceId),
	});

	const [email, setEmail] = useState("");
	const [role, setRole] = useState<GrantRole>("viewer");

	const createMut = useMutation({
		mutationFn: () => grantsApi.create(serviceId, { email, role }),
		onSuccess: () => {
			toast.success("Erişim verildi");
			qc.invalidateQueries({ queryKey: ["service-grants", serviceId] });
			setEmail("");
		},
		onError: (e: Error & { response?: { data?: { error?: string } } }) =>
			toast.error(e.response?.data?.error ?? "Grant oluşturulamadı"),
	});

	const updateMut = useMutation({
		mutationFn: ({ grantId, role }: { grantId: string; role: GrantRole }) =>
			grantsApi.update(serviceId, grantId, role),
		onSuccess: () => {
			toast.success("Rol güncellendi");
			qc.invalidateQueries({ queryKey: ["service-grants", serviceId] });
		},
		onError: () => toast.error("Güncelleme başarısız"),
	});

	const removeMut = useMutation({
		mutationFn: (grantId: string) => grantsApi.remove(serviceId, grantId),
		onSuccess: () => {
			toast.success("Erişim kaldırıldı");
			qc.invalidateQueries({ queryKey: ["service-grants", serviceId] });
		},
		onError: () => toast.error("Silme başarısız"),
	});

	return (
		<div
			className="rounded border p-4"
			style={{
				background: "var(--card-bg)",
				borderColor: "var(--border-subtle)",
			}}
		>
			<div className="mb-3 flex items-center gap-2">
				<Shield
					className="size-4"
					style={{ color: "var(--text-faint)" }}
				/>
				<span
					className="text-sm font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Paylaşım
				</span>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					placeholder="kullanici@firma.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="h-9"
				/>
				<select
					value={role}
					onChange={(e) => setRole(e.target.value as GrantRole)}
					className="h-9 rounded border px-2 text-sm"
					style={{
						background: "var(--input-bg)",
						borderColor: "var(--input-border)",
						color: "var(--text-secondary)",
					}}
				>
					<option value="viewer">Viewer</option>
					<option value="operator">Operator</option>
					<option value="admin">Admin</option>
				</select>
				<Button
					size="sm"
					disabled={!email.trim() || createMut.isPending}
					onClick={() => createMut.mutate()}
					className="gap-1 h-9"
				>
					<UserPlus className="size-3.5" /> Ekle
				</Button>
			</div>

			<div className="mt-3 space-y-1">
				{!grants || grants.length === 0 ? (
					<div
						className="rounded border border-dashed py-4 text-center text-xs"
						style={{
							borderColor: "var(--border-subtle)",
							color: "var(--text-faint)",
						}}
					>
						Bu servis henüz başka kullanıcılarla paylaşılmadı.
					</div>
				) : (
					grants.map((g) => (
						<div
							key={g.id}
							className="flex items-center justify-between rounded border px-3 py-2"
							style={{
								background: "var(--input-bg)",
								borderColor: "var(--border-subtle)",
							}}
						>
							<div className="min-w-0 flex-1">
								<div
									className="text-sm truncate"
									style={{ color: "var(--text-primary)" }}
								>
									{g.grantee_email}
								</div>
								<div
									className="text-[10px]"
									style={{ color: "var(--text-faint)" }}
								>
									{ROLE_LABEL[g.role]}
								</div>
							</div>
							<select
								value={g.role}
								onChange={(e) =>
									updateMut.mutate({
										grantId: g.id,
										role: e.target.value as GrantRole,
									})
								}
								className="mr-2 h-7 rounded border px-1.5 text-xs"
								style={{
									background: "var(--card-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							>
								<option value="viewer">viewer</option>
								<option value="operator">operator</option>
								<option value="admin">admin</option>
							</select>
							<Button
								variant="ghost"
								size="sm"
								className="text-red-400 hover:bg-red-500/10"
								onClick={() => {
									if (confirm(`${g.grantee_email} erişimini kaldır?`)) {
										removeMut.mutate(g.id);
									}
								}}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
