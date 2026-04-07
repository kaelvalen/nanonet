import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 3000,
		host: true,
		allowedHosts: true,
		watch: {
			usePolling: true,
		},
		hmr: {
			clientPort: 443,
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
