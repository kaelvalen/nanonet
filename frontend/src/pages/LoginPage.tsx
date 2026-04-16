import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const { login, isLoggingIn } = useAuth();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		login({ email, password });
	};

	return (
		<AuthLayout
			title={t("auth.login", "Sign in")}
			subtitle={t("auth.login_subtitle", "Monitor everything. Miss nothing.")}
			footer={
				<>
					<span className="text-sm text-slate-400 font-medium">
						{t("auth.noAccount")}
					</span>
					<Link
						to="/register"
						className="text-sm font-black text-slate-900 hover:text-teal-600 transition-colors"
					>
						{t("auth.register")} →
					</Link>
				</>
			}
		>
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

				<PasswordField
					id="password"
					label={t("auth.password")}
					value={password}
					onChange={setPassword}
					autoComplete="current-password"
					disabled={isLoggingIn}
					rightSlot={
						<Link
							to="/forgot-password"
							className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
						>
							{t("auth.forgotPassword")}
						</Link>
					}
				/>

				<AuthSubmitButton
					loading={isLoggingIn}
					loadingLabel={t("auth.signingIn", "Signing in...")}
					disabled={!email || !password}
				>
					{t("auth.signIn", "Sign in")} →
				</AuthSubmitButton>
			</form>
		</AuthLayout>
	);
}
