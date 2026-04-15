import { Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthNetworkPanel } from "@/components/auth/AuthNetworkPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const { login, isLoggingIn } = useAuth();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		login({ email, password });
	};

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

					<div className="mb-10">
						<h1 className="text-[2.1rem] font-black text-slate-900 tracking-tighter leading-none mb-2">
							Sign in
						</h1>
						<p className="text-sm text-slate-400 font-medium leading-relaxed">
							{t("auth.login_subtitle", "Monitor everything. Miss nothing.")}
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-5">
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
								className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:border-teal-500 transition-colors"
								required
								disabled={isLoggingIn}
							/>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="password"
									className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400"
								>
									{t("auth.password")}
								</Label>
								<Link
									to="/forgot-password"
									className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
								>
									{t("auth.forgotPassword")}
								</Link>
							</div>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									placeholder="••••••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:border-teal-500 transition-colors pr-11"
									required
									disabled={isLoggingIn}
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
						</div>

						<Button
							type="submit"
							disabled={isLoggingIn || !email || !password}
							className="w-full h-11 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-black tracking-wide transition-all duration-200 active:scale-[0.99] disabled:opacity-40 mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
						>
							{isLoggingIn ? (
								<span className="flex items-center gap-2.5">
									<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									Signing in...
								</span>
							) : (
								"Sign in →"
							)}
						</Button>
					</form>

					<div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-1.5">
						<span className="text-sm text-slate-400 font-medium">
							{t("auth.noAccount")}
						</span>
						<Link
							to="/register"
							className="text-sm font-black text-slate-900 hover:text-teal-600 transition-colors"
						>
							{t("auth.register")} →
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
