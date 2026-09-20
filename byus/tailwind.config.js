/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // teal is the primary accent (unchanged -- chosen deliberately in a prior
          // commit specifically to avoid a UKG brand-color collision). gold and clay
          // were accidentally collapsed onto this same hex during an earlier "replace
          // coral accents" pass and have rendered as flat teal ever since, everywhere
          // from CTA buttons to "Founding" badges. Restored here as their own distinct
          // hues -- gold matches this repo's own original, git-historied brand gold;
          // clay is deepened from that same history's terracotta (#C97C5D) so white
          // badge text (FeaturedCreators, ProfileClient, browse, demo) stays readable
          // against it (~5.8:1 contrast, was ~3.1:1).
          teal: '#0F766E',
          gold: '#C9A961',
          clay: '#A6432E',
          // Warm neutrals -- replace the old pure-white/black-opacity scale everywhere
          // (cards, text, borders, dividers) so the whole site sits on one warm-brown
          // neutral instead of a cold gray one. `cream` is the page background (already
          // used as a raw hex in layout.js; formalized here), `paper` is a hair lighter
          // for cards so they still lift off the page without going stark white, and
          // `ink` replaces `black` as the base for every text/border/divider opacity
          // utility (e.g. `text-brand-ink/60` instead of `text-black/60`) so muted text
          // and hairline borders read as warm taupe instead of cold gray.
          cream: '#F8FAFC',
          paper: '#FFFFFF',
          ink: '#172033',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      // Ambient drift for the two blurred corner blobs in the dark hero band --
      // purely decorative background motion, separate from the "live" pulse dot on the
      // demo button (which is tied to something real). Applied via `motion-safe:` so it
      // never needs its own JS/media-query handling for prefers-reduced-motion.
      keyframes: {
        'byus-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-18px, 12px) scale(1.06)' },
        },
      },
      animation: {
        'byus-drift': 'byus-drift 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
