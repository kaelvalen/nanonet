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
					<div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
						<CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
						<div className="min-w-0">
							<p className="text-sm font-semibold text-slate-900">
								Bağlantı gönderildi
							</p>
							<p className="text-xs text-slate-500 mt-1 leading-relaxed break-all">
								{email} adresini kontrol edin. Bağlantı 1 saat geçerlidir.
							</p>
						</div>
					</div>
					<Link
						to="/login"
						className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
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
					className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-teal-600 transition-colors"
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
						className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
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
						className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:border-teal-500 transition-colors"
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
