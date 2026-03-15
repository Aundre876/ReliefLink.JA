/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rescue: {
          primary: "#0c4a6e",
          secondary: "#0e7490",
          accent: "#f59e0b",
          surface: "#f0f9ff",
          danger: "#dc2626",
        },
        logistics: {
          primary: "#166534",
          secondary: "#15803d",
          surface: "#f0fdf4",
          accent: "#22c55e",
        },
        emergency: {
          primary: "#FF4136",
          surface: "#1a1a1a",
          accent: "#ef4444",
        },
      },
    },
  },
  plugins: [],
}
