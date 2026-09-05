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
          clay: '#C97C5D',
          // Warm neutrals -- replace the old pure-white/black-opacity scale everywhere
          // (cards, text, borders, dividers) so the whole site sits on one warm-brown
          // neutral instead of a cold gray one. `cream` is the page background (already
          // used as a raw hex in layout.js; formalized here), `paper` is a hair lighter
          // for cards so they still lift off the page without going stark white, and
          // `ink` replaces `black` as the base for every text/border/divider opacity
          // utility (e.g. `text-brand-ink/60` instead of `text-black/60`) so muted text
          // and hairline borders read as warm taupe instead of cold gray.
          cream: '#E8DCC4',
          paper: '#FFFCF6',
          ink: '#2B2420',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
