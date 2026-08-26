/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#146359',
          gold: '#C9A961',
        },
      },
    },
  },
  plugins: [],
};
