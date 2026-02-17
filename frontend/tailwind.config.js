/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        up: '#22c55e',
        degraded: '#f59e0b',
        down: '#ef4444',
      },
    },
  },
  plugins: [],
}
