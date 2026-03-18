import { Eye, EyeOff, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const { login, isLoggingIn } = useAuth();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		login({ email, password });
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
			{/* Background — flat grid pattern */}
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
					damping: 20,
				}}
				className="relative z-10 w-full max-w-sm"
			>
				{/* Logo */}
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
						<div
							className="w-16 h-16 rounded flex items-center justify-center mx-auto"
							style={{
								background: "var(--gradient-logo)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							<span className="text-white text-2xl">✦</span>
						</div>
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
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35 }}
						className="text-sm mt-1"
						style={{ color: "var(--text-muted)" }}
					>
						Mikroservis İzleme Platformu
					</motion.p>
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
							border: "2px solid var(--border-default)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						<div className="mb-6">
							<h2
								className="text-lg font-semibold"
								style={{ color: "var(--text-secondary)" }}
							>
								Hoş Geldiniz
							</h2>
							<p
								className="text-xs mt-0.5"
								style={{ color: "var(--text-muted)" }}
							>
								Hesabınıza giriş yapın
							</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-4">
							<motion.div
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.3 }}
								className="grid gap-2"
							>
								<Label
									htmlFor="email"
									className="text-xs font-medium"
									style={{ color: "var(--text-secondary)" }}
								>
									E-posta
								</Label>
								<Input
									id="email"
									type="email"
									placeholder="admin@nanonet.dev"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="rounded transition-all"
									style={{
										background: "var(--input-bg)",
										borderColor: "var(--input-border)",
										color: "var(--text-secondary)",
									}}
									required
									disabled={isLoggingIn}
								/>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.38 }}
								className="grid gap-2"
							>
								<div className="flex items-center justify-between">
									<Label
										htmlFor="password"
										className="text-foreground text-xs font-medium"
									>
										Şifre
									</Label>
									<Link
										to="/forgot-password"
										className="text-[10px] transition-colors"
										style={{ color: "var(--text-muted)" }}
									>
										Şifremi Unuttum
									</Link>
								</div>
								<div className="relative">
									<Input
										id="password"
										type={showPassword ? "text" : "password"}
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="rounded pr-10 transition-all"
										style={{
											background: "var(--input-bg)",
											borderColor: "var(--input-border)",
											color: "var(--text-secondary)",
										}}
										required
										disabled={isLoggingIn}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
										style={{ color: "var(--text-faint)" }}
									>
										{showPassword ? (
											<EyeOff className="w-4 h-4" />
										) : (
											<Eye className="w-4 h-4" />
										)}
									</button>
								</div>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.46 }}
							>
								<Button
									type="submit"
									disabled={isLoggingIn || !email || !password}
									className="w-full text-white rounded h-10 transition-all disabled:opacity-60"
									style={{
										background: "var(--gradient-btn-primary)",
										boxShadow: "var(--btn-shadow)",
									}}
								>
									{isLoggingIn ? (
										<div className="flex items-center gap-2">
											<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
											Giriş yapılıyor...
										</div>
									) : (
										<div className="flex items-center gap-2">
											<Sparkles className="w-4 h-4" />
											Giriş Yap
										</div>
									)}
								</Button>
							</motion.div>
						</form>

						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.55 }}
							className="mt-6 text-center"
						>
							<p className="text-xs" style={{ color: "var(--text-muted)" }}>
								Hesabınız yok mu?{" "}
								<Link
									to="/register"
									className="font-medium transition-colors"
									style={{ color: "var(--text-link)" }}
								>
									Kayıt Ol
								</Link>
							</p>
						</motion.div>
					</Card>
				</motion.div>

				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.6 }}
					className="text-center mt-5"
				>
					<p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
						NanoNet v2.0 · Powered by AI
					</p>
				</motion.div>
			</motion.div>
		</div>
	);
}
