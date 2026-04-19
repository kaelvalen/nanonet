interface PasswordStrengthProps {
	password: string;
}

const COLORS = [
	"transparent",
	"var(--status-down)",
	"var(--status-degraded)",
	"var(--status-up)",
];
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
		<div className="flex items-center gap-3 pt-2">
			<div className="flex gap-1 flex-1">
				{[1, 2, 3].map((level) => (
					<div
						key={level}
						className="h-[2px] flex-1 rounded-full overflow-hidden"
						style={{ background: "var(--surface-sunken)" }}
					>
						<div
							className="h-full transition-all duration-200"
							style={{
								width: strength >= level ? "100%" : "0%",
								backgroundColor: COLORS[strength],
							}}
						/>
					</div>
				))}
			</div>
			<span
				className="text-[10px] font-medium tnum"
				style={{ color: COLORS[strength] }}
			>
				{LABELS[strength]}
			</span>
		</div>
	);
}
