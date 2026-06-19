import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
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
			style={{ background: "var(--surface-canvas)" }}
		>
			<div
				className="hidden lg:block lg:w-[44%] relative overflow-hidden"
				style={{ borderRight: "1px solid var(--border-subtle)" }}
			>
				<AuthNetworkPanel />
			</div>

			<div
				className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 lg:px-14 py-10 relative"
				style={{ background: "var(--surface-base)" }}
			>
				<div className="w-full max-w-sm">
					<div
						className="flex items-center gap-2 mb-10 lg:hidden"
						style={{ color: "var(--text-primary)" }}
					>
						<Logo className="w-5 h-5" />
						<span
							className="font-semibold text-[14px] tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							NanoNet
						</span>
					</div>

					<header className="mb-8">
						<p
							className="text-[10px] font-mono uppercase tracking-wider mb-3"
							style={{ color: "var(--text-faint)" }}
						>
							NanoNet · auth
						</p>
						<h1
							className="text-[28px] font-semibold tracking-tight leading-[1.1] mb-2"
							style={{ color: "var(--text-primary)" }}
						>
							{title}
						</h1>
						<p
							className="text-[14px] leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							{subtitle}
						</p>
					</header>

					{children}

					{footer && (
						<div
							className="mt-8 pt-6 flex items-center gap-1.5 flex-wrap"
							style={{ borderTop: "1px solid var(--border-subtle)" }}
						>
							{footer}
						</div>
					)}
				</div>

				<div className="absolute bottom-6 right-8 hidden lg:block">
					<p
						className="text-[10px] font-mono tracking-wider uppercase"
						style={{ color: "var(--text-faint)" }}
					>
						v2.0
					</p>
				</div>
			</div>
		</div>
	);
}
