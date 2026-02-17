import { useEffect, useRef } from "react";

export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Pastel shapes floating upward - stars, circles, hearts
    interface Shape {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      color: string;
      type: "star" | "circle" | "diamond";
      rotation: number;
      rotationSpeed: number;
      wobble: number;
      wobbleSpeed: number;
    }

    const colors = [
      "rgba(57, 197, 187, ", // miku teal
      "rgba(147, 197, 253, ", // baby blue
      "rgba(196, 181, 253, ", // lavender
      "rgba(253, 164, 175, ", // pink
      "rgba(167, 243, 208, ", // mint
      "rgba(255, 209, 220, ", // cinna pink
    ];

    const shapes: Shape[] = [];
    const shapeCount = 35;

    for (let i = 0; i < shapeCount; i++) {
      shapes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 6 + 2,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: (["star", "circle", "diamond"] as const)[Math.floor(Math.random() * 3)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.005,
      });
    }

    function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation: number) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.stroke();
      // Cross sparkle
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      shapes.forEach((shape) => {
        shape.y -= shape.speed;
        shape.rotation += shape.rotationSpeed;
        shape.wobble += shape.wobbleSpeed;
        const xOffset = Math.sin(shape.wobble) * 0.5;
        shape.x += xOffset;

        // Reset when off screen
        if (shape.y < -20) {
          shape.y = canvas.height + 20;
          shape.x = Math.random() * canvas.width;
        }

        const alpha = shape.opacity;

        if (shape.type === "circle") {
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
          ctx.fillStyle = shape.color + alpha + ")";
          ctx.fill();
        } else if (shape.type === "star") {
          ctx.strokeStyle = shape.color + alpha + ")";
          ctx.lineWidth = 1;
          drawStar(ctx, shape.x, shape.y, shape.size, shape.rotation);
        } else {
          // Diamond
          ctx.save();
          ctx.translate(shape.x, shape.y);
          ctx.rotate(shape.rotation);
          ctx.beginPath();
          ctx.moveTo(0, -shape.size);
          ctx.lineTo(shape.size * 0.6, 0);
          ctx.lineTo(0, shape.size);
          ctx.lineTo(-shape.size * 0.6, 0);
          ctx.closePath();
          ctx.fillStyle = shape.color + alpha + ")";
          ctx.fill();
          ctx.restore();
        }
      });
    }

    const interval = setInterval(draw, 33);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-60 z-0"
    />
  );
}
