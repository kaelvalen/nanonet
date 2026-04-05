import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
			<div
				className="fixed inset-0 pointer-events-none z-0"
				style={{
					backgroundImage: `radial-gradient(var(--dot-pattern) 1px, transparent 1px)`,
					backgroundSize: "28px 28px",
				}}
			/>

			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{
					duration: 0.5,
					type: "spring",
					stiffness: 220,
					damping: 18,
				}}
				className="relative z-10 w-full max-w-sm"
			>
				<div className="text-center mb-8">
					<motion.div
						initial={{ scale: 0, rotate: -10 }}
						animate={{ scale: 1, rotate: 0 }}
						transition={{
							delay: 0.15,
							type: "spring",
							stiffness: 300,
							damping: 18,
						}}
						className="inline-block mb-4"
					>
						<img
							src={logo}
							alt="NanoNet"
							className="w-24 h-24 rounded object-contain mx-auto"
						/>
					</motion.div>
					<motion.h1
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.25 }}
						className="text-3xl bg-clip-text text-transparent font-(--font-quicksand)"
						style={{ backgroundImage: "var(--gradient-text)" }}
					>
						NanoNet
					</motion.h1>
				</div>

				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					<Card
						className="rounded p-8"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						{sent ? (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								className="text-center py-4"
							>
								<div className="flex justify-center mb-4">
									<CheckCircle
										className="w-12 h-12"
										style={{ color: "var(--status-up)" }}
									/>
								</div>
								<h2
									className="text-base font-semibold mb-2"
									style={{ color: "var(--text-secondary)" }}
								>
									Kontrol edin
								</h2>
								<p
									className="text-xs leading-relaxed"
									style={{ color: "var(--text-muted)" }}
								>
									Eğer{" "}
									<span
										className="font-medium"
										style={{ color: "var(--text-secondary)" }}
									>
										{email}
									</span>{" "}
									adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
								</p>
								<p
									className="text-xs mt-3"
									style={{ color: "var(--text-faint)" }}
								>
									Bağlantı 1 saat geçerlidir.
								</p>
								<Link
									to="/login"
									className="mt-6 inline-flex items-center gap-1.5 text-xs transition-colors"
									style={{ color: "var(--text-link)" }}
								>
									<ArrowLeft className="w-3.5 h-3.5" />
									Giriş sayfasına dön
								</Link>
							</motion.div>
						) : (
							<>
								<div className="mb-6">
									<h2
										className="text-lg font-semibold"
										style={{ color: "var(--text-secondary)" }}
									>
										Şifremi Unuttum
									</h2>
									<p
										className="text-xs mt-0.5"
										style={{ color: "var(--text-muted)" }}
									>
										Email adresinizi girin, sıfırlama bağlantısı gönderelim.
									</p>
								</div>

								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="grid gap-2">
										<Label
											htmlFor="email"
											className="text-xs font-medium"
											style={{ color: "var(--text-secondary)" }}
										>
											Email
										</Label>
										<div className="relative">
											<Mail
												className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
												style={{ color: "var(--text-faint)" }}
											/>
											<Input
												id="email"
												type="email"
												placeholder="ornek@nanonet.dev"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												className="rounded pl-9 transition-all"
												style={{
													background: "var(--input-bg)",
													borderColor: "var(--input-border)",
													color: "var(--text-secondary)",
												}}
												required
											/>
										</div>
									</div>

									<Button
										type="submit"
										disabled={loading || !email}
										className="w-full text-white rounded h-10 transition-all disabled:opacity-60"
										style={{
											background: "var(--gradient-btn-primary)",
											boxShadow: "var(--btn-shadow)",
										}}
									>
										{loading ? (
											<div className="flex items-center gap-2">
												<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												Gönderiliyor...
											</div>
										) : (
											"Sıfırlama Bağlantısı Gönder"
										)}
									</Button>
								</form>

								<div className="mt-6 text-center">
									<Link
										to="/login"
										className="inline-flex items-center gap-1.5 text-xs transition-colors"
										style={{ color: "var(--text-muted)" }}
									>
										<ArrowLeft className="w-3.5 h-3.5" />
										Giriş sayfasına dön
									</Link>
								</div>
							</>
						)}
					</Card>
				</motion.div>
			</motion.div>
		</div>
	);
}
