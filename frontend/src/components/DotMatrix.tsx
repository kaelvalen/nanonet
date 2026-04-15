import { useEffect, useRef } from "react";

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
const GLOW_RADIUS = 180;
const SPEED = 1.8;

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

		// DVD bounce state
		let bx = Math.random() * 600 + 100;
		let by = Math.random() * 400 + 100;
		let vx = SPEED * (Math.random() > 0.5 ? 1 : -1);
		let vy = SPEED * (Math.random() > 0.5 ? 1 : -1);

		function resize() {
			if (!canvas) return;
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
		}

		function getDotColor(): [number, number, number] {
			const dark = document.documentElement.classList.contains("dark");
			return dark ? [45, 212, 191] : [13, 148, 136];
		}

		function draw(t: number) {
			if (!ctx || !canvas) return;

			// Bounce
			bx += vx;
			by += vy;
			if (bx <= 0 || bx >= width) { vx = -vx; bx = Math.max(0, Math.min(width, bx)); }
			if (by <= 0 || by >= height) { vy = -vy; by = Math.max(0, Math.min(height, by)); }

			ctx.clearRect(0, 0, width, height);

			const [r, g, b] = getDotColor();
			const cols = Math.ceil(width / DOT_SPACING) + 1;
			const rows = Math.ceil(height / DOT_SPACING) + 1;

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const x = col * DOT_SPACING;
					const y = row * DOT_SPACING;

					const dx = x - bx;
					const dy = y - by;
					const dist = Math.sqrt(dx * dx + dy * dy);

					// Base pulse
					const pulse = 0.08 + 0.04 * Math.sin(t * 0.001 + col * 0.3 + row * 0.3);

					// Glow from bounce light
					let glow = 0;
					if (dist < GLOW_RADIUS) {
						const norm = 1 - dist / GLOW_RADIUS;
						// Sharp inner core + soft outer halo
						glow = norm * norm * 0.85;
					}

					const alpha = Math.min(1, pulse + glow);
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
			aria-hidden="true"
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
