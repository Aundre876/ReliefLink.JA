/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
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
      },
    },
  },
  plugins: [],
};
