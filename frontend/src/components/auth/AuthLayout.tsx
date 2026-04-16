import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AuthNetworkPanel } from "./AuthNetworkPanel";

interface AuthLayoutProps {
	title: string;
	subtitle: string;
	children: ReactNode;
	footer?: ReactNode;
}

/**
 * Shared split-screen layout used by Login, Register, ForgotPassword,
 * ResetPassword. Keeps visual language consistent across the auth flow.
 */
export function AuthLayout({
	title,
	subtitle,
	children,
	footer,
}: AuthLayoutProps) {
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
					{/* Mobile-only brand */}
					<div className="flex items-center gap-2 mb-10 lg:hidden">
						<span className="text-slate-900 font-black text-sm tracking-tight">
							NanoNet
						</span>
					</div>

					<div className="mb-8">
						<h1 className="text-[2.1rem] font-black text-slate-900 tracking-tighter leading-none mb-2">
							{title}
						</h1>
						<p className="text-sm text-slate-400 font-medium leading-relaxed">
							{subtitle}
						</p>
					</div>

					{children}

					{footer && (
						<div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-1.5">
							{footer}
						</div>
					)}
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
