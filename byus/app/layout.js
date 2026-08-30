import './globals.css';
import { Fraunces } from 'next/font/google';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Warm serif for headlines only — pairs with the default sans body text to give the
// brand some editorial warmth instead of reading as a generic SaaS product.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const SITE_URL = process.env.APP_URL || 'https://byus-ten.vercel.app';

// Separate from `metadata` (Next.js 14 moved theme-color/viewport concerns out of
// the metadata export) -- tints the mobile browser chrome (address bar, task
// switcher) the brand teal instead of leaving it default white/gray.
export const viewport = {
  themeColor: '#146359',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ByUs — Creator subscriptions, simplified',
  description: 'Support creators you love. Creators keep 90% of every payment.',
  openGraph: {
    title: 'ByUs — Creator subscriptions, simplified',
    description: 'Support creators you love. Creators keep 90% of every payment.',
    url: SITE_URL,
    siteName: 'ByUs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ByUs — Creator subscriptions, simplified',
    description: 'Support creators you love. Creators keep 90% of every payment.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="flex min-h-screen flex-col bg-[#FAF8F4] text-[#1A1A1A] antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
