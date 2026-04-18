import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

export function ResetPasswordPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token") ?? "";

	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	const passwordsMatch = password === confirm;
	const passwordStrong = password.length >= 12;
	const canSubmit = !!token && passwordStrong && passwordsMatch && !loading;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		setLoading(true);
		try {
			await authApi.resetPassword(token, password);
			setDone(true);
			setTimeout(() => navigate("/login"), 2500);
		} catch (err: unknown) {
			const msg =
				(err as { response?: { data?: { error?: string } } })?.response?.data
					?.error ??
				"Şifre sıfırlanamadı. Bağlantı geçersiz veya süresi dolmuş olabilir.";
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return (
			<AuthLayout
				title="Geçersiz bağlantı"
				subtitle="Sıfırlama token'ı bulunamadı veya süresi dolmuş."
			>
				<div className="space-y-5">
					<div
						className="flex items-start gap-3 p-4 rounded-lg"
						style={{
							background: "var(--status-warn-subtle)",
							border: "1px solid var(--status-warn-border)",
						}}
					>
						<AlertCircle
							className="w-5 h-5 shrink-0 mt-0.5"
							style={{ color: "var(--status-warn-text)" }}
						/>
						<p
							className="text-sm"
							style={{ color: "var(--text-primary)" }}
						>
							Bağlantı geçersiz ya da süresi dolmuş olabilir. Yeni bir sıfırlama
							bağlantısı talep edin.
						</p>
					</div>
					<Link
						to="/forgot-password"
						className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
						style={{ color: "var(--brand-primary)" }}
					>
						Yeni bağlantı talep et →
					</Link>
				</div>
			</AuthLayout>
		);
	}

	if (done) {
		return (
			<AuthLayout
				title="Şifre güncellendi"
				subtitle="Giriş sayfasına yönlendiriliyorsunuz."
			>
				<div
					className="flex items-start gap-3 p-4 rounded-lg"
					style={{
						background: "var(--status-up-subtle)",
						border: "1px solid var(--status-up-border)",
					}}
				>
					<CheckCircle
						className="w-5 h-5 shrink-0 mt-0.5"
						style={{ color: "var(--status-up-text)" }}
					/>
					<p
						className="text-sm"
						style={{ color: "var(--text-primary)" }}
					>
						Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş
						yapabilirsiniz.
					</p>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title="Yeni şifre belirle"
			subtitle="En az 12 karakter kullanın. Güçlü bir şifre seçtiğinizden emin olun."
			footer={
				<Link
					to="/login"
					className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
					style={{ color: "var(--text-muted)" }}
				>
					<ArrowLeft className="w-4 h-4" />
					Girişe dön
				</Link>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<PasswordField
						id="password"
						label="Yeni şifre"
						value={password}
						onChange={setPassword}
						autoComplete="new-password"
						disabled={loading}
						error={
							password && !passwordStrong ? "En az 12 karakter gerekli" : null
						}
					/>
					<PasswordStrength password={password} />
				</div>

				<PasswordField
					id="confirm"
					label="Şifre tekrar"
					value={confirm}
					onChange={setConfirm}
					autoComplete="new-password"
					disabled={loading}
					success={confirm.length > 0 && passwordsMatch}
					error={confirm && !passwordsMatch ? "Şifreler eşleşmiyor" : null}
				/>

				<AuthSubmitButton
					loading={loading}
					loadingLabel="Kaydediliyor..."
					disabled={!canSubmit}
				>
					Şifreyi sıfırla →
				</AuthSubmitButton>
			</form>
		</AuthLayout>
	);
}
