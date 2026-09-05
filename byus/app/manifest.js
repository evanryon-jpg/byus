// Next.js serves this at /manifest.webmanifest and links it in <head> automatically.
// Lets creators/fans on Android "Add to Home Screen" with the real name, the
// ampersand icon, and the brand teal -- instead of the browser guessing.
export default function manifest() {
  return {
    name: 'ByUs — Creator subscriptions, simplified',
    short_name: 'ByUs',
    description: 'Support creators you love. Creators keep 90% of every payment.',
    start_url: '/',
    display: 'standalone',
    background_color: '#E8DCC4',
    theme_color: '#146359',
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
