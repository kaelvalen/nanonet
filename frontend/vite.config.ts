import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return;

					if (id.includes("/recharts/")) return "charts";
					if (id.includes("/pdf-lib/")) return "pdf";
					if (id.includes("/@tanstack/")) return "query";
					if (id.includes("/react-router/")) return "router";

					return "vendor";
				},
			},
		},
	},
	server: {
		port: 3000,
		host: true,
		allowedHosts: true,
		watch: {
			// Polling Docker bind-mount'larda stabil; lokal dev'de gereksiz CPU yakar.
			usePolling: process.env.DOCKER === "true",
		},
		proxy: {
			"/api": {
				target: process.env.VITE_API_TARGET ?? "http://localhost:8080",
				changeOrigin: true,
			},
			"/ws": {
				target: process.env.VITE_WS_TARGET ?? "ws://localhost:8080",
				ws: true,
			},
		},
	},
});
