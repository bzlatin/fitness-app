/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["SpaceGrotesk-Regular", "System"],
        display: ["SpaceGrotesk-SemiBold", "System"],
      },
      colors: {
        background: "#050816",
        surface: {
          DEFAULT: "#0B1220",
          muted: "#111827",
        },
        primary: "#22C55E",
        secondary: "#38BDF8",
        text: {
          primary: "#F9FAFB",
          secondary: "#9CA3AF",
        },
        border: "#1F2933",
      },
    },
  },
  plugins: [],
};
