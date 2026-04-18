import { ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			await authApi.forgotPassword(email);
			setSent(true);
		} catch {
			toast.error("İşlem gerçekleştirilemedi, lütfen tekrar deneyin.");
		} finally {
			setLoading(false);
		}
	};

	if (sent) {
		return (
			<AuthLayout
				title="Kontrol edin"
				subtitle="Kayıtlı ise e-postanıza sıfırlama bağlantısı gönderdik."
			>
				<div className="space-y-5">
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
						<div className="min-w-0">
							<p
								className="text-sm font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Bağlantı gönderildi
							</p>
							<p
								className="text-xs mt-1 leading-relaxed break-all"
								style={{ color: "var(--text-muted)" }}
							>
								{email} adresini kontrol edin. Bağlantı 1 saat geçerlidir.
							</p>
						</div>
					</div>
					<Link
						to="/login"
						className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
						style={{ color: "var(--brand-primary)" }}
					>
						<ArrowLeft className="w-4 h-4" />
						Giriş sayfasına dön
					</Link>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title="Şifremi unuttum"
			subtitle="E-posta adresinizi girin, sıfırlama bağlantısı gönderelim."
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
			<form onSubmit={handleSubmit} className="space-y-5">
				<div className="space-y-1.5">
					<Label
						htmlFor="email"
						className="text-[12px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						E-posta
					</Label>
					<Input
						id="email"
						type="email"
						autoComplete="email"
						placeholder="ornek@nanonet.dev"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="h-11 rounded-lg text-sm font-medium"
						required
						disabled={loading}
					/>
				</div>

				<AuthSubmitButton
					loading={loading}
					loadingLabel="Gönderiliyor..."
					disabled={!email}
				>
					Sıfırlama bağlantısı gönder →
				</AuthSubmitButton>
			</form>
		</AuthLayout>
	);
}
