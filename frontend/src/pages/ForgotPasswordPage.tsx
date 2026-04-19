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
						className="relative flex items-start gap-3 px-4 py-3 rounded-[6px]"
						style={{
							background: "var(--status-up-subtle)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<span
							aria-hidden
							className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
							style={{ background: "var(--status-up)" }}
						/>
						<CheckCircle
							className="w-4 h-4 shrink-0 mt-0.5 ml-1"
							style={{ color: "var(--status-up)" }}
						/>
						<div className="min-w-0">
							<p
								className="text-[13px] font-medium"
								style={{ color: "var(--text-primary)" }}
							>
								Bağlantı gönderildi
							</p>
							<p
								className="text-[12px] mt-1 leading-relaxed break-all"
								style={{ color: "var(--text-tertiary)" }}
							>
								{email} adresini kontrol edin. Bağlantı 1 saat geçerlidir.
							</p>
						</div>
					</div>
					<Link
						to="/login"
						className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
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
					className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
					style={{ color: "var(--text-tertiary)" }}
				>
					<ArrowLeft className="w-4 h-4" />
					Girişe dön
				</Link>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-1.5">
					<Label
						htmlFor="email"
						className="text-[12px] font-medium"
						style={{ color: "var(--text-tertiary)" }}
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
						className="h-10"
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
