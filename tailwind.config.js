/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: "#17191E",
          panel: "#1F2229",
          border: "#31353F",
          card: "#F4F1EA",
          ink: "#231C12",
          gold: "#D9A441",
          goldLight: "#E8C27A",
          bronze: "#A6864F",
          green: "#5F8F5B",
          orange: "#C1613B",
          orangeLight: "#D98B6B",
          muted: "#9A9EA8",
          mutedDark: "#6B6F79",
          mutedLight: "#C7CAD1",
        },
      },
    },
  },
  plugins: [],
};
