/* Logo — NanoNet brand mark.
 *
 * Concept C: 3×3 dot grid. Eight outlined nodes form the lattice of the
 * monitored estate; the single filled cyan dot is the "live" node — the
 * service we're paying attention to right now. The composition reads as
 *   ○ ○ ○
 *   ○ ○ ●   ← active
 *   ○ ○ ○
 * which is asymmetric on purpose (perfect symmetry would feel inert).
 *
 * Implementation notes:
 *  - Inline SVG (not <img>) so the eight outline circles inherit
 *    `currentColor` and adapt to dark/light theme without two asset files.
 *  - The active node is hardcoded to brand cyan (--brand-primary fallback
 *    #22D3EE) — it must NEVER change with theme; it's the brand signal.
 *  - viewBox is 24×24, the canonical icon grid; strokes are 1.25 so they
 *    stay crisp at favicon size while reading clearly at 32+ px.
 *  - `aria-hidden` by default (decorative); pass `title` to expose a label
 *    when the logo carries the only meaning (rare — most call sites pair
 *    it with a wordmark).
 */

import { type SVGProps } from "react";

interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "title"> {
	title?: string;
}

const OUTLINE_DOTS: { cx: number; cy: number }[] = [
	{ cx: 5, cy: 5 },
	{ cx: 12, cy: 5 },
	{ cx: 19, cy: 5 },
	{ cx: 5, cy: 12 },
	{ cx: 12, cy: 12 },
	{ cx: 5, cy: 19 },
	{ cx: 12, cy: 19 },
	{ cx: 19, cy: 19 },
];

export function Logo({ title, className, ...rest }: LogoProps) {
	const labelled = Boolean(title);
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role={labelled ? "img" : undefined}
			aria-hidden={labelled ? undefined : true}
			aria-label={labelled ? title : undefined}
			className={className}
			{...rest}
		>
			{title ? <title>{title}</title> : null}
			{OUTLINE_DOTS.map((d) => (
				<circle
					key={`${d.cx}-${d.cy}`}
					cx={d.cx}
					cy={d.cy}
					r={2.75}
					stroke="currentColor"
					strokeWidth={1.25}
					strokeOpacity={0.32}
				/>
			))}
			{/* Active node — brand cyan, fixed across themes. */}
			<circle
				cx={19}
				cy={12}
				r={2.75}
				fill="var(--brand-primary, #22D3EE)"
			/>
		</svg>
	);
}
