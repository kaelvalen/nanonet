/* NanonetAd — looping brand reel for the landing hero gap.
 *
 * Ported from the standalone "Nanonet Ad" React-via-Babel HTML demo. This
 * version drops the screen-recording chrome (REC dot, timecode HUD, corner
 * ticks, vignette) so it reads as a clean motion piece embedded in the
 * page rather than a captured demo.
 *
 * Internals:
 *  - Single requestAnimationFrame loop drives a `time` state in [0, DURATION].
 *  - Six Sprite scenes mounted unconditionally; each one renders only when
 *    the playhead is within its [start, end] window. Same pattern as the
 *    original — keeps the timing math identical to the source.
 *  - `useReducedMotion()` short-circuits to a static end-card; no rAF, no
 *    state churn, no animation. Honors the user's accessibility choice.
 *  - The component renders into the parent's box at any aspect; the inner
 *    stage is fixed at 1920×1080 and CSS-scaled. Pass a sized container.
 *
 * Performance: when the tab is hidden, requestAnimationFrame pauses
 * automatically. Off-screen the loop keeps running but the math is cheap
 * (no DOM work happens for sprites outside their window).
 */

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

const DURATION = 14.5;

/* Palette is intentionally aligned with the landing page tokens
 * (INK_RAISED / TXT / TXT_DIM / TXT_FAINT / BRAND) so the embedded
 * reel reads as a continuation of the surface it's placed on rather
 * than a foreign asset. `bg: transparent` lets the host container's
 * INK_RAISED show through. */
const BRAND = {
	cyan: "#22d3ee",
	cyanSoft: "rgba(34, 211, 238, 0.10)",
	cyanGlow: "rgba(34, 211, 238, 0.45)",
	bg: "transparent",
	fg: "#fafaf9",
	fgDim: "rgba(250, 250, 249, 0.46)",
	fgFaint: "rgba(250, 250, 249, 0.10)",
} as const;

interface NodeDef {
	x: number;
	y: number;
	id: number;
	hero?: boolean;
}

const NODES: NodeDef[] = [
	{ x: 5, y: 5, id: 0 },
	{ x: 12, y: 5, id: 1 },
	{ x: 19, y: 5, id: 2 },
	{ x: 5, y: 12, id: 3 },
	{ x: 12, y: 12, id: 4 },
	{ x: 19, y: 12, id: 5, hero: true },
	{ x: 5, y: 19, id: 6 },
	{ x: 12, y: 19, id: 7 },
	{ x: 19, y: 19, id: 8 },
];

/* ── Easing ─────────────────────────────────────────────────────────────── */

const clamp = (v: number, min: number, max: number) =>
	Math.max(min, Math.min(max, v));

const Easing = {
	easeInCubic: (t: number) => t * t * t,
	easeOutCubic: (t: number) => 1 + (t - 1) ** 3,
	easeInOutCubic: (t: number) =>
		t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
	easeOutBack: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
	},
	easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
};

/* ── LogoGrid primitive ──────────────────────────────────────────────────
 * Renders the 3×3 mark at any size with per-node overrides and optional
 * connection lines drawn from a `from` node to a `to` node, trimmed by
 * `progress` ∈ [0,1]. Coords come from the 0..24 logo viewBox. */

interface NodeStyle {
	opacity?: number;
	scale?: number;
	activated?: number;
	glow?: number;
}

interface ConnectionDef {
	from: NodeDef;
	to: NodeDef;
	progress: number;
}

/* All-SVG implementation. The previous pass used absolutely-positioned
 * <div>s with thick CSS borders for the outline nodes; once the parent
 * stage was CSS-scaled (1920×1080 → ~520px), the browser rasterized those
 * borders before scaling, producing visibly aliased "low resolution"
 * edges during the entry animation. SVG circles render vectorially
 * regardless of any ancestor transform, so dots and strokes stay crisp
 * at every frame. */
function LogoGrid({
	size,
	getNode,
	connections = [],
}: {
	size: number;
	getNode?: (n: NodeDef, i: number) => NodeStyle;
	connections?: ConnectionDef[];
}) {
	/* useId so multiple LogoGrid instances on the page don't collide on
	 * filter IDs (would happen if two scenes overlap during a fade). */
	const uid = useId().replace(/[:]/g, "_");
	const lineGlowId = `nn-ad-line-glow-${uid}`;
	const nodeGlowId = `nn-ad-node-glow-${uid}`;

	/* All inner geometry is in viewBox units (0..24), so we don't need a
	 * pixel scale here — the outer SVG element's `size` controls the
	 * rendered dimensions and the browser handles vector scaling. */
	const r = 2.75;
	const strokeW = 1.25;

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			style={{ display: "block", overflow: "visible" }}
			shapeRendering="geometricPrecision"
			aria-hidden="true"
		>
			<defs>
				<filter id={lineGlowId} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="0.1" result="b" />
					<feMerge>
						<feMergeNode in="b" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<filter id={nodeGlowId} x="-100%" y="-100%" width="300%" height="300%">
					<feGaussianBlur stdDeviation="0.35" />
				</filter>
			</defs>

			{connections.map((c) => {
				const x1 = c.from.x;
				const y1 = c.from.y;
				const x2 = c.to.x;
				const y2 = c.to.y;
				const tx = x1 + (x2 - x1) * c.progress;
				const ty = y1 + (y2 - y1) * c.progress;
				return (
					<line
						key={`${c.from.id}-${c.to.id}`}
						x1={x1}
						y1={y1}
						x2={tx}
						y2={ty}
						stroke={BRAND.cyan}
						strokeWidth={0.08}
						strokeLinecap="round"
						opacity={0.85 * c.progress}
						filter={`url(#${lineGlowId})`}
					/>
				);
			})}

			{NODES.map((n, i) => {
				const cfg = getNode ? getNode(n, i) : {};
				const s = cfg.scale ?? 1;
				const op = cfg.opacity ?? 1;
				const act = cfg.activated ?? 0;
				const glow = cfg.glow ?? 0;

				const stroke = n.hero
					? "transparent"
					: `rgba(250, 250, 249, ${(1 - act) * 0.32})`;
				const fill = n.hero ? BRAND.cyan : `rgba(34, 211, 238, ${act})`;
				/* Two-stop halo to mirror the original CSS box-shadow recipe
				 *   `0 0 ${glow}px cyanGlow, 0 0 ${glow*2}px cyanSoft`
				 * but in SVG units. The previous single-stop, oversized halo
				 * (r*2.6, opacity → 0.9) made the hero node read as floodlit.
				 * Now: an inner halo barely past the dot edge for the warm
				 * core, plus a wider, much fainter outer wash. Envelope is
				 * proportional to `glow / 60` so even peak pulse glows
				 * (~30) cap at a tasteful 0.5 intensity. */
				const haloT = clamp(glow / 60, 0, 0.5);

				return (
					<g
						key={n.id}
						transform={`translate(${n.x} ${n.y}) scale(${s})`}
						opacity={op}
					>
						{haloT > 0 && (
							<>
								<circle
									cx={0}
									cy={0}
									r={r * 1.9}
									fill={BRAND.cyanSoft}
									opacity={haloT * 0.6}
									filter={`url(#${nodeGlowId})`}
								/>
								<circle
									cx={0}
									cy={0}
									r={r * 1.35}
									fill={BRAND.cyanGlow}
									opacity={haloT}
									filter={`url(#${nodeGlowId})`}
								/>
							</>
						)}
						<circle
							cx={0}
							cy={0}
							r={r}
							fill={fill}
							stroke={stroke}
							strokeWidth={n.hero ? 0 : strokeW}
						/>
					</g>
				);
			})}
		</svg>
	);
}

/* ── Sprite envelope ─────────────────────────────────────────────────────
 * Renders children only inside [start, end]. Provides a fade in/out
 * envelope so scenes don't pop. */

interface SpriteCtx {
	localTime: number;
	duration: number;
}

function Sprite({
	start,
	end,
	time,
	fadeIn = 0.5,
	fadeOut = 0.6,
	children,
}: {
	start: number;
	end: number;
	time: number;
	fadeIn?: number;
	fadeOut?: number;
	children: (ctx: SpriteCtx) => React.ReactNode;
}) {
	if (time < start || time > end) return null;

	const duration = end - start;
	const localTime = time - start;
	const inT = clamp(localTime / fadeIn, 0, 1);
	const outStart = Math.max(0, duration - fadeOut);
	const outT = clamp((localTime - outStart) / fadeOut, 0, 1);
	const opacity =
		Easing.easeInOutCubic(inT) * (1 - Easing.easeInOutCubic(outT));

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				opacity,
				willChange: "opacity",
			}}
		>
			{children({ localTime, duration })}
		</div>
	);
}

const centerStage: React.CSSProperties = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

const monoFont =
	"'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/* ── Scenes ──────────────────────────────────────────────────────────── */

/* Logo sizing constants tuned so content fills the host panel without
 * over-cropping. Bumped from the original 520/180/140 set after the
 * embed felt small inside its 16:9 frame. */
const LOGO_HERO = 720;
const LOGO_LOCKUP = 240;
const LOGO_END = 200;

function Scene1GridAppear({ time }: { time: number }) {
	return (
		<Sprite start={0} end={2.6} time={time} fadeIn={0.01} fadeOut={0.8}>
			{({ localTime }) => (
				<div style={centerStage}>
					<LogoGrid
						size={LOGO_HERO}
						getNode={(n, i) => {
							const delay = 0.08 * i;
							const t = clamp((localTime - delay) / 0.5, 0, 1);
							const eased = Easing.easeOutCubic(t);
							return {
								opacity: eased * (n.hero ? 0 : 1),
								scale: 0.4 + 0.6 * eased,
							};
						}}
					/>
				</div>
			)}
		</Sprite>
	);
}

function Scene2HeroIgnite({ time }: { time: number }) {
	return (
		<Sprite start={1.6} end={3.8} time={time} fadeIn={0.6} fadeOut={0.7}>
			{({ localTime }) => {
				const appear = clamp(localTime / 0.6, 0, 1);
				const pulse = Math.sin(localTime * 4) * 0.5 + 0.5;
				return (
					<div style={centerStage}>
						<LogoGrid
							size={LOGO_HERO}
							getNode={(n) => {
								if (!n.hero) return { opacity: 1, scale: 1 };
								const eased = Easing.easeOutBack(appear);
								return {
									opacity: appear,
									scale: 0.3 + 0.7 * eased,
									glow: 12 + pulse * 18,
								};
							}}
						/>
					</div>
				);
			}}
		</Sprite>
	);
}

function Scene3Network({ time }: { time: number }) {
	return (
		<Sprite start={3.2} end={6.4} time={time} fadeIn={0.7} fadeOut={0.8}>
			{({ localTime }) => {
				const heroIdx = 5;
				const hero = NODES[heroIdx];
				const connections = NODES.map((n, i) => ({
					n,
					i,
					d: Math.hypot(n.x - hero.x, n.y - hero.y),
				}))
					.filter((c) => c.i !== heroIdx)
					.sort((a, b) => a.d - b.d);

				return (
					<div style={centerStage}>
						<LogoGrid
							size={LOGO_HERO}
							connections={connections.map((c, idx) => {
								const delay = 0.12 * idx;
								const t = clamp((localTime - delay) / 0.6, 0, 1);
								return {
									from: hero,
									to: c.n,
									progress: Easing.easeOutCubic(t),
								};
							})}
							getNode={(n, i) => {
								if (n.hero) return { opacity: 1, scale: 1, glow: 14 };
								const conIdx = connections.findIndex((c) => c.i === i);
								const delay = 0.12 * conIdx + 0.5;
								const t = clamp((localTime - delay) / 0.35, 0, 1);
								const eased = Easing.easeOutBack(t);
								return {
									opacity: 1,
									scale: 1 + 0.25 * eased * (1 - t),
									activated: t,
								};
							}}
						/>
					</div>
				);
			}}
		</Sprite>
	);
}

function Scene4Wordmark({ time }: { time: number }) {
	return (
		<Sprite start={5.4} end={9.4} time={time} fadeIn={0.7} fadeOut={0.8}>
			{({ localTime }) => {
				const shrink = clamp(localTime / 0.8, 0, 1);
				const eased = Easing.easeInOutCubic(shrink);
				const logoSize = LOGO_HERO - (LOGO_HERO - LOGO_LOCKUP) * eased;
				const logoX = -eased * 280;

				const word = "nanonet";
				const wordStart = 0.7;
				const letterStagger = 0.055;
				const kickerT = clamp((localTime - 0.55) / 0.4, 0, 1);

				return (
					<div style={centerStage}>
						<div style={{ transform: `translateX(${logoX}px)` }}>
							<LogoGrid
								size={logoSize}
								getNode={(n) => ({
									opacity: 1,
									scale: 1,
									activated: 0,
									glow: n.hero ? 10 : 0,
								})}
							/>
						</div>

						<div
							style={{
								position: "absolute",
								left: "50%",
								top: "50%",
								transform: `translate(${-eased * 280 + logoSize / 2 + 56}px, -50%)`,
							}}
						>
							<div
								style={{
									opacity: kickerT,
									transform: `translateY(${(1 - kickerT) * 6}px)`,
									fontFamily: monoFont,
									fontSize: 16,
									letterSpacing: "0.28em",
									textTransform: "uppercase",
									color: BRAND.fgDim,
									marginBottom: 18,
									display: "flex",
									alignItems: "center",
									gap: 12,
								}}
							>
								<span
									style={{ width: 24, height: 1, background: BRAND.cyan }}
								/>
								<span>introducing</span>
							</div>

							<div style={{ overflow: "hidden", paddingBottom: 8 }}>
								<div
									style={{
										display: "flex",
										fontFamily: monoFont,
										fontSize: 132,
										fontWeight: 500,
										letterSpacing: "-0.05em",
										color: BRAND.fg,
										lineHeight: 0.95,
									}}
								>
									{word.split("").map((ch, i) => {
										const t = clamp(
											(localTime - wordStart - i * letterStagger) / 0.6,
											0,
											1,
										);
										const e = Easing.easeOutExpo(t);
										return (
											<span
												// biome-ignore lint/suspicious/noArrayIndexKey: per-letter slot in fixed word
												key={i}
												style={{
													display: "inline-block",
													transform: `translateY(${(1 - e) * 100}%)`,
													opacity: e,
												}}
											>
												{ch}
											</span>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				);
			}}
		</Sprite>
	);
}

function Scene5Tagline({ time }: { time: number }) {
	return (
		<Sprite start={8.6} end={12.6} time={time} fadeIn={0.8} fadeOut={0.9}>
			{({ localTime }) => {
				const lines: {
					words: string[];
					delay: number;
					accentLast?: boolean;
				}[] = [
					{ words: ["Watch", "your", "services"], delay: 0.15 },
					{
						words: ["with", "high", "precision."],
						delay: 0.85,
						accentLast: true,
					},
				];

				const metaT = clamp(localTime / 0.5, 0, 1);
				const metaEased = Easing.easeOutCubic(metaT);
				const ruleT = clamp((localTime - 1.6) / 0.7, 0, 1);
				const ruleEased = Easing.easeOutExpo(ruleT);
				const captionT = clamp((localTime - 2.0) / 0.5, 0, 1);

				return (
					<div style={centerStage}>
						<div style={{ position: "relative", textAlign: "center" }}>
							<div
								style={{
									opacity: metaEased,
									transform: `translateY(${(1 - metaEased) * 8}px)`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: 14,
									marginBottom: 44,
									fontFamily: monoFont,
									fontSize: 18,
									letterSpacing: "0.22em",
									textTransform: "uppercase",
									color: BRAND.fgDim,
								}}
							>
								<span
									style={{ width: 28, height: 1, background: BRAND.cyan }}
								/>
								<span>Observability, distilled</span>
							</div>

							<div
								style={{
									fontFamily: monoFont,
									fontWeight: 500,
									fontSize: 100,
									lineHeight: 1.08,
									letterSpacing: "-0.035em",
									color: BRAND.fg,
									whiteSpace: "nowrap",
								}}
							>
								{lines.map((ln) => (
									<div
										key={`line-${ln.delay}`}
										style={{
											display: "block",
											overflow: "hidden",
											paddingBottom: 8,
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "center",
												gap: "0.3em",
												flexWrap: "nowrap",
											}}
										>
											{ln.words.map((w, wi) => {
												const wordDelay = ln.delay + wi * 0.09;
												const wt = clamp((localTime - wordDelay) / 0.7, 0, 1);
												const we = Easing.easeOutExpo(wt);
												const isAccent =
													ln.accentLast && wi === ln.words.length - 1;
												return (
													<span
														key={`${ln.delay}-${w}`}
														style={{
															display: "inline-block",
															transform: `translateY(${(1 - we) * 100}%)`,
															opacity: we,
															color: isAccent ? BRAND.cyan : BRAND.fg,
															willChange: "transform, opacity",
														}}
													>
														{w}
													</span>
												);
											})}
										</div>
									</div>
								))}
							</div>

							<div
								style={{
									marginTop: 52,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: 20,
								}}
							>
								<div
									style={{
										height: 1,
										width: 420 * ruleEased,
										background: `linear-gradient(90deg, ${BRAND.cyan}, rgba(34,211,238,0))`,
									}}
								/>
								<div
									style={{
										opacity: captionT,
										fontFamily: monoFont,
										fontSize: 16,
										letterSpacing: "0.18em",
										textTransform: "uppercase",
										color: BRAND.fgDim,
									}}
								>
									Every request. Every node.
								</div>
							</div>
						</div>
					</div>
				);
			}}
		</Sprite>
	);
}

function Scene6EndCard({ time }: { time: number }) {
	return (
		<Sprite start={11.6} end={14.5} time={time} fadeIn={0.9} fadeOut={0.01}>
			{({ localTime }) => {
				const t = clamp(localTime / 0.7, 0, 1);
				const eased = Easing.easeOutCubic(t);
				const pulse = Math.sin(localTime * 2.5) * 0.5 + 0.5;

				return (
					<div style={centerStage}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 32,
								opacity: eased,
								transform: `translateY(${(1 - eased) * 16}px)`,
							}}
						>
							<LogoGrid
								size={LOGO_END}
								getNode={(n) => {
									const hero = NODES[5];
									const d = Math.hypot(n.x - hero.x, n.y - hero.y);
									const maxD = Math.hypot(14, 7);
									const order = 1 - d / maxD;
									const fadeStart = 0.9 + (1 - order) * 0.9;
									const fadeT = clamp((localTime - fadeStart) / 0.45, 0, 1);
									const fadeEased = Easing.easeInOutCubic(fadeT);

									if (n.hero) {
										return {
											opacity: 1,
											scale: 1,
											activated: 1,
											glow: 8 + pulse * 10,
										};
									}
									return {
										opacity: 1,
										scale: 1,
										activated: 1 - fadeEased,
									};
								}}
							/>
							<div
								style={{
									fontFamily: monoFont,
									fontSize: 96,
									fontWeight: 500,
									letterSpacing: "-0.04em",
									color: BRAND.fg,
									lineHeight: 1,
								}}
							>
								nanonet
							</div>
						</div>
					</div>
				);
			}}
		</Sprite>
	);
}

/* ── Stage shell ─────────────────────────────────────────────────────────
 * Fixed 1920×1080 logical canvas, CSS-scaled into the parent box. The
 * parent is responsible for setting an aspect-ratio (e.g. aspect-[16/9])
 * and a width — the stage fills it and locks its content to 16:9. */

function StageInner({ time }: { time: number }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: BRAND.bg,
				overflow: "hidden",
			}}
		>
			{/* Dotted grid backdrop — pitch and opacity tuned to the GridBackdrop
			    used elsewhere on the landing page so the reel reads as the same
			    surface, not a foreign canvas. The recording-chrome vignette is
			    intentionally removed; depth comes from the host panel border. */}
			<div
				aria-hidden
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `radial-gradient(${BRAND.fgFaint} 1px, transparent 1px)`,
					backgroundSize: "32px 32px",
					opacity: 0.6,
					maskImage:
						"radial-gradient(ellipse at center, black 35%, transparent 85%)",
					WebkitMaskImage:
						"radial-gradient(ellipse at center, black 35%, transparent 85%)",
				}}
			/>

			{/* Logical 1920×1080 stage scaled into parent box. */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					width: 1920,
					height: 1080,
					transform: "translate(-50%, -50%) scale(var(--nn-ad-scale, 1))",
					transformOrigin: "center",
				}}
			>
				<Scene1GridAppear time={time} />
				<Scene2HeroIgnite time={time} />
				<Scene3Network time={time} />
				<Scene4Wordmark time={time} />
				<Scene5Tagline time={time} />
				<Scene6EndCard time={time} />
			</div>
		</div>
	);
}

/* ── Public component ─────────────────────────────────────────────────── */

export function NanonetAd({ className }: { className?: string }) {
	const reduce = useReducedMotion();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [time, setTime] = useState(0);
	const [scale, setScale] = useState(1);

	/* ResizeObserver — re-derive the CSS scale that fits the 1920×1080
	 * stage into the container box without distorting aspect. */
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const w = el.clientWidth;
			const h = el.clientHeight;
			if (w === 0 || h === 0) return;
			const s = Math.min(w / 1920, h / 1080);
			setScale(s);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	/* rAF loop — modulo at DURATION for seamless looping. Skipped entirely
	 * when the user prefers reduced motion. */
	useEffect(() => {
		if (reduce) return;
		let raf = 0;
		let last: number | null = null;
		const tick = (ts: number) => {
			if (last == null) last = ts;
			const dt = (ts - last) / 1000;
			last = ts;
			setTime((t) => {
				const next = t + dt;
				return next >= DURATION ? next % DURATION : next;
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [reduce]);

	return (
		<div
			ref={containerRef}
			className={className}
			style={
				{
					position: "relative",
					overflow: "hidden",
					"--nn-ad-scale": scale,
				} as React.CSSProperties
			}
			role="img"
			aria-label="NanoNet animasyonlu logo gösterimi"
		>
			{reduce ? (
				/* Reduced motion: render the static end-card pose. */
				<StageInner time={12.5} />
			) : (
				<StageInner time={time} />
			)}
		</div>
	);
}
