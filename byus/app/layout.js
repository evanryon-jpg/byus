import './globals.css';
import { Fraunces, Karla } from 'next/font/google';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Warm serif for headlines only — pairs with the Karla body text below to give the
// brand some editorial warmth instead of reading as a generic SaaS product. 700/800
// added on top of the original 500/600 so hero headlines can go bolder without pulling
// in every weight the family offers.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

// Body font for everything that isn't a headline. Warmer and a little more
// characterful than a generic system sans stack, without tipping into the
// "safe SaaS default" territory of Inter/Geist -- keeps the site from reading
// as a template.
const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
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
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="flex min-h-screen flex-col bg-[#E8DCC4] text-[#2B2420] antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
