import { motion } from "motion/react";

interface PasswordStrengthProps {
	password: string;
}

const COLORS = ["", "#f43f5e", "#f59e0b", "#34d399"];
const LABELS = ["", "Zayıf", "Orta", "Güçlü"];

function computeStrength(password: string): number {
	if (password.length === 0) return 0;
	if (password.length < 6) return 1;
	if (password.length < 10) return 2;
	return 3;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
	if (!password) return null;
	const strength = computeStrength(password);

	return (
		<div className="flex items-center gap-3 pt-1">
			<div className="flex gap-1 flex-1">
				{[1, 2, 3].map((level) => (
					<div
						key={level}
						className="h-0.5 flex-1 rounded-full bg-slate-100 overflow-hidden"
					>
						<motion.div
							animate={{ width: strength >= level ? "100%" : "0%" }}
							transition={{ duration: 0.3 }}
							className="h-full"
							style={{ backgroundColor: COLORS[strength] }}
						/>
					</div>
				))}
			</div>
			<span
				className="text-[10px] font-bold tabular-nums"
				style={{ color: COLORS[strength] }}
			>
				{LABELS[strength]}
			</span>
		</div>
	);
}
