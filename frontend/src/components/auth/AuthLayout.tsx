import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AuthNetworkPanel } from "./AuthNetworkPanel";

interface AuthLayoutProps {
	title: string;
	subtitle: string;
	children: ReactNode;
	footer?: ReactNode;
}

export function AuthLayout({
	title,
	subtitle,
	children,
	footer,
}: AuthLayoutProps) {
	return (
		<div
			className="min-h-screen w-full flex flex-col lg:flex-row"
			style={{ background: "var(--app-bg)" }}
		>
			<div
				className="hidden lg:block lg:w-[44%] relative overflow-hidden"
				style={{ borderRight: "1px solid var(--border-default)" }}
			>
				<AuthNetworkPanel />
			</div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.45, delay: 0.15 }}
				className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 lg:px-14 py-10 relative"
				style={{ background: "var(--surface-card)" }}
			>
				<div className="w-full max-w-sm">
					<div className="flex items-center gap-2 mb-8 lg:hidden">
						<span
							className="font-black text-sm tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							NanoNet
						</span>
					</div>

					<div className="mb-7">
						<h1
							className="text-[1.85rem] sm:text-[2.1rem] font-black tracking-tighter leading-none mb-2"
							style={{ color: "var(--text-primary)" }}
						>
							{title}
						</h1>
						<p
							className="text-sm font-medium leading-relaxed"
							style={{ color: "var(--text-muted)" }}
						>
							{subtitle}
						</p>
					</div>

					{children}

					{footer && (
						<div
							className="mt-7 pt-7 flex items-center gap-1.5 flex-wrap"
							style={{ borderTop: "1px solid var(--border-subtle)" }}
						>
							{footer}
						</div>
					)}
				</div>

				<div className="absolute bottom-6 right-8 hidden lg:block">
					<p
						className="text-[10px] font-mono tracking-widest uppercase"
						style={{ color: "var(--text-faint)" }}
					>
						Signal over noise · v2.0
					</p>
				</div>
			</motion.div>
		</div>
	);
}
