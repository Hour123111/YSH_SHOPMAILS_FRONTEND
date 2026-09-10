tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#ecf8f6",
          100: "#d3efe9",
          200: "#a8ddd3",
          300: "#74c4b7",
          400: "#3fa496",
          500: "#1f8a7c",
          600: "#0b6e63",
          700: "#08554d",
          800: "#07443e",
          900: "#063832",
        },
        accent: {
          50: "#fff7ed",
          500: "#e8891a",
          600: "#c46d0c",
        },
      },
      fontFamily: {
        sans: ['"Manrope"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Manrope"', "sans-serif"],
      },
    },
  },
};

(function initTheme() {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (stored === "dark" || (!stored && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
})();

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
}
