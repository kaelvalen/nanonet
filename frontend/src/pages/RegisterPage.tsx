import { Check, Eye, EyeOff, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthNetworkPanel } from "@/components/auth/AuthNetworkPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

function PasswordStrength({ password }: { password: string }) {
	const s =
		password.length === 0
			? 0
			: password.length < 6
				? 1
				: password.length < 10
					? 2
					: 3;
	const colors = ["", "#f43f5e", "#f59e0b", "#34d399"];
	const labels = ["", "Weak", "Fair", "Strong"];
	if (!password) return null;
	return (
		<div className="flex items-center gap-3 pt-1">
			<div className="flex gap-1 flex-1">
				{[1, 2, 3].map((l) => (
					<div
						key={l}
						className="h-0.5 flex-1 rounded-full bg-slate-100 overflow-hidden"
					>
						<motion.div
							animate={{ width: s >= l ? "100%" : "0%" }}
							transition={{ duration: 0.3 }}
							className="h-full"
							style={{ backgroundColor: colors[s] }}
						/>
					</div>
				))}
			</div>
			<span
				className="text-[10px] font-bold tabular-nums"
				style={{ color: colors[s] }}
			>
				{labels[s]}
			</span>
		</div>
	);
}

export function RegisterPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const { register, isRegistering } = useAuth();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (password !== confirmPassword) return;
		register({ email, password });
	};

	const passwordsMatch =
		confirmPassword.length > 0 && password === confirmPassword;
	const passwordMismatch =
		confirmPassword.length > 0 && password !== confirmPassword;

	return (
		<div className="h-screen w-full flex overflow-hidden bg-white">
			{/* Left: Live Network Visualization */}
			<div className="hidden lg:block w-[44%] relative overflow-hidden border-r border-slate-800">
				<AuthNetworkPanel />
			</div>

			{/* Right: Form */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.45, delay: 0.15 }}
				className="flex-1 flex flex-col items-center justify-center px-8 lg:px-14 bg-white relative"
			>
				<div className="w-full max-w-sm">
					{/* Mobile-only logo */}
					<div className="flex items-center gap-2 mb-10 lg:hidden">
						<span className="text-slate-900 font-black text-sm tracking-tight">
							NanoNet
						</span>
					</div>

					<div className="mb-8">
						<h1 className="text-[2.1rem] font-black text-slate-900 tracking-tighter leading-none mb-2">
							Create account
						</h1>
						<p className="text-sm text-slate-400 font-medium leading-relaxed">
							{t(
								"auth.register_subtitle",
								"Start monitoring in under 30 seconds.",
							)}
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label
								htmlFor="email"
								className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
							>
								{t("auth.email")}
							</Label>
							<Input
								id="email"
								type="email"
								autoComplete="email"
								placeholder="you@company.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors"
								required
								disabled={isRegistering}
							/>
						</div>

						<div className="space-y-1.5">
							<Label
								htmlFor="password"
								className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
							>
								{t("auth.password")}
							</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									autoComplete="new-password"
									placeholder="Min. 12 characters"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors pr-11"
									required
									disabled={isRegistering}
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
									tabIndex={-1}
								>
									{showPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
							<PasswordStrength password={password} />
						</div>

						<div className="space-y-1.5">
							<Label
								htmlFor="confirm-password"
								className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
							>
								{t("auth.confirmPassword")}
							</Label>
							<div className="relative">
								<Input
									id="confirm-password"
									type={showPassword ? "text" : "password"}
									autoComplete="new-password"
									placeholder="••••••••••••"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className={`h-11 rounded-lg bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 transition-colors pr-11 ${
										passwordMismatch
											? "border-red-300 focus-visible:ring-red-400"
											: passwordsMatch
												? "border-emerald-300 focus-visible:ring-emerald-400"
												: "border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
									}`}
									required
									disabled={isRegistering}
								/>
								{confirmPassword && (
									<div className="absolute right-3.5 top-1/2 -translate-y-1/2">
										{passwordsMatch ? (
											<Check className="w-4 h-4 text-emerald-500" />
										) : (
											<X className="w-4 h-4 text-red-400" />
										)}
									</div>
								)}
							</div>
						</div>

						<Button
							type="submit"
							disabled={
								isRegistering ||
								passwordMismatch ||
								!email ||
								!password ||
								!confirmPassword
							}
							className="w-full h-11 rounded-lg bg-slate-900 hover:bg-indigo-600 text-white text-sm font-black tracking-wide transition-all duration-200 active:scale-[0.99] disabled:opacity-40 mt-1 shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
						>
							{isRegistering ? (
								<span className="flex items-center gap-2.5">
									<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									Creating account...
								</span>
							) : (
								"Get started →"
							)}
						</Button>
					</form>

					<div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-1.5">
						<span className="text-sm text-slate-400 font-medium">
							{t("auth.haveAccount")}
						</span>
						<Link
							to="/login"
							className="text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors"
						>
							Sign in →
						</Link>
					</div>
				</div>

				<div className="absolute bottom-8 right-10 hidden lg:block">
					<p className="text-[10px] font-mono text-slate-300 tracking-widest uppercase">
						Signal over noise · v2.0
					</p>
				</div>
			</motion.div>
		</div>
	);
}
