/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // These resolve to CSS custom properties set at runtime by
        // TenantContext.jsx, so `bg-primary` / `text-primary` / `border-primary`
        // automatically follow whichever company's branding is active.
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
      },
    },
  },
  plugins: [],
};
