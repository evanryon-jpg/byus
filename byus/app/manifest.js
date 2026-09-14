// Next.js serves this at /manifest.webmanifest and links it in <head> automatically.
// Lets creators/fans on Android "Add to Home Screen" with the real name, the
// app icon, and the brand teal -- instead of the browser guessing.
export default function manifest() {
  return {
    name: 'ByUs — Creator subscriptions, simplified',
    short_name: 'ByUs',
    description: 'Join creator memberships on ByUs. Creators keep 87–90% of every subscription payment.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#0F766E',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
