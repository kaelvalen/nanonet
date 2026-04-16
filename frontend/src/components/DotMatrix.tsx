import { useEffect, useRef } from "react";

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
// How thick the N stroke glow falloff is (px)
const STROKE_GLOW = 55;
// Wave travel speed along the N strokes
const WAVE_SPEED = 0.0012;
// How wide the bright wave band is (0–1 in normalised stroke param)
const WAVE_WIDTH = 0.22;

/** Signed distance from point (px,py) to segment (ax,ay)→(bx,by) */
function distToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(px - ax, py - ay);
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Closest t ∈ [0,1] along segment for point projection */
function projT(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return 0;
	return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
}

export function DotMatrix() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let width = 0;
		let height = 0;

		function resize() {
			if (!canvas) return;
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
			initBounce();
		}

		function getDotColor(): [number, number, number] {
			const dark = document.documentElement.classList.contains("dark");
			return dark ? [45, 212, 191] : [13, 148, 136];
		}

		/**
		 * Build the 3 segments of a capital N centred on (cx, cy).
		 * h = total height, w = total width of the letter bounding box.
		 */
		function getNSegments(cx: number, cy: number, h: number, w: number) {
			const x0 = cx - w / 2;
			const x1 = cx + w / 2;
			const yTop = cy - h / 2;
			const yBot = cy + h / 2;
			return [
				// Left vertical
				{ ax: x0, ay: yTop, bx: x0, by: yBot },
				// Right vertical
				{ ax: x1, ay: yTop, bx: x1, by: yBot },
				// Diagonal left-top → right-bottom
				{ ax: x0, ay: yTop, bx: x1, by: yBot },
			];
		}

		// N bounding-box half-sizes (computed once resize is done)
		let letterH = 0;
		let letterW = 0;

		// DVD bounce position (centre of the N)
		let bx = 0;
		let by = 0;
		let vx = 0;
		let vy = 0;
		const SPEED = 1.2;

		function initBounce() {
			letterH = Math.min(height * 0.55, 460);
			letterW = letterH * 0.55;
			bx = width / 2;
			by = height / 2;
			const angle = Math.random() * Math.PI * 2;
			vx = Math.cos(angle) * SPEED;
			vy = Math.sin(angle) * SPEED;
		}

		function draw(t: number) {
			if (!ctx || !canvas) return;
			ctx.clearRect(0, 0, width, height);

			const [r, g, b] = getDotColor();
			const cols = Math.ceil(width / DOT_SPACING) + 1;
			const rows = Math.ceil(height / DOT_SPACING) + 1;

			// Bounce N centre within safe margins
			const marginX = letterW / 2 + DOT_SPACING;
			const marginY = letterH / 2 + DOT_SPACING;
			bx += vx;
			by += vy;
			if (bx < marginX || bx > width - marginX) {
				vx = -vx;
				bx = Math.max(marginX, Math.min(width - marginX, bx));
			}
			if (by < marginY || by > height - marginY) {
				vy = -vy;
				by = Math.max(marginY, Math.min(height - marginY, by));
			}

			const segments = getNSegments(bx, by, letterH, letterW);

			// Wave phase advances over time — sweeps along each stroke
			const wavePhase = (t * WAVE_SPEED) % 1;

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const x = col * DOT_SPACING;
					const y = row * DOT_SPACING;

					// Ambient base pulse (very subtle)
					const base =
						0.06 + 0.02 * Math.sin(t * 0.0005 + col * 0.25 + row * 0.25);

					let nGlow = 0;

					for (const seg of segments) {
						const dist = distToSegment(x, y, seg.ax, seg.ay, seg.bx, seg.by);
						if (dist > STROKE_GLOW) continue;

						// Proximity glow — soft falloff from stroke
						const proximity = (1 - dist / STROKE_GLOW) ** 2;

						// Wave: bright band sweeping along the stroke
						const tProj = projT(x, y, seg.ax, seg.ay, seg.bx, seg.by);
						// Wrap wave: distance of tProj from moving wave front
						let waveDist = Math.abs(tProj - wavePhase);
						// wrap-around so wave loops seamlessly
						if (waveDist > 0.5) waveDist = 1 - waveDist;
						const waveBrightness =
							waveDist < WAVE_WIDTH
								? (1 - waveDist / WAVE_WIDTH) ** 1.5 * 0.9
								: 0;

						nGlow = Math.max(nGlow, proximity * (0.25 + waveBrightness));
					}

					const alpha = Math.min(1, base + nGlow);
					if (alpha < 0.04) continue;

					ctx.beginPath();
					ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
					ctx.fill();
				}
			}

			rafRef.current = requestAnimationFrame(draw);
		}

		resize();
		window.addEventListener("resize", resize);
		rafRef.current = requestAnimationFrame(draw);

		return () => {
			window.removeEventListener("resize", resize);
			cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: -1,
				pointerEvents: "none",
				display: "block",
			}}
		/>
	);
}
