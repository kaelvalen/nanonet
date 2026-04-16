import { Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function RegisterPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const { register, isRegistering } = useAuth();

	const passwordsMatch =
		confirmPassword.length > 0 && password === confirmPassword;
	const passwordMismatch =
		confirmPassword.length > 0 && password !== confirmPassword;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (password !== confirmPassword) return;
		register({ email, password });
	};

	const confirmIcon = confirmPassword ? (
		<span className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
			{passwordsMatch ? (
				<Check className="w-4 h-4 text-emerald-500" />
			) : (
				<X className="w-4 h-4 text-red-400" />
			)}
		</span>
	) : null;

	return (
		<AuthLayout
			title={t("auth.register", "Create account")}
			subtitle={t(
				"auth.register_subtitle",
				"Start monitoring in under 30 seconds.",
			)}
			footer={
				<>
					<span className="text-sm text-slate-400 font-medium">
						{t("auth.haveAccount")}
					</span>
					<Link
						to="/login"
						className="text-sm font-black text-slate-900 hover:text-teal-600 transition-colors"
					>
						{t("auth.login", "Sign in")} →
					</Link>
				</>
			}
		>
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
						className="h-11 rounded-lg border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:border-teal-500 transition-colors"
						required
						disabled={isRegistering}
					/>
				</div>

				<div>
					<PasswordField
						id="password"
						label={t("auth.password")}
						value={password}
						onChange={setPassword}
						autoComplete="new-password"
						placeholder={t("auth.passwordMinHint", "Min. 12 characters")}
						disabled={isRegistering}
					/>
					<PasswordStrength password={password} />
				</div>

				<div className="relative">
					<PasswordField
						id="confirm-password"
						label={t("auth.confirmPassword")}
						value={confirmPassword}
						onChange={setConfirmPassword}
						autoComplete="new-password"
						disabled={isRegistering}
						success={passwordsMatch}
						error={passwordMismatch ? t("auth.passwordMismatch", "Şifreler eşleşmiyor") : null}
					/>
					{confirmIcon}
				</div>

				<AuthSubmitButton
					loading={isRegistering}
					loadingLabel={t("auth.creatingAccount", "Creating account...")}
					disabled={
						passwordMismatch ||
						!email ||
						!password ||
						!confirmPassword
					}
				>
					{t("auth.getStarted", "Get started")} →
				</AuthSubmitButton>
			</form>
		</AuthLayout>
	);
}
