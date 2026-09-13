import './globals.css';
import { Suspense } from 'react';
import { Fraunces, Karla } from 'next/font/google';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ConversionAnalytics from './components/ConversionAnalytics';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700', '800'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const karla = Karla({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const SITE_URL = process.env.APP_URL || 'https://byus-ten.vercel.app';

export const viewport = { themeColor: '#146359' };
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ByUs — Creator subscriptions, simplified',
  description: 'Join creator memberships on ByUs. Creators keep 87–90% of every subscription payment.',
  openGraph: { title: 'ByUs — Creator subscriptions, simplified', description: 'Join creator memberships on ByUs. Creators keep 87–90% of every subscription payment.', url: SITE_URL, siteName: 'ByUs', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'ByUs — Creator subscriptions, simplified', description: 'Join creator memberships on ByUs. Creators keep 87–90% of every subscription payment.' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="flex min-h-screen flex-col bg-[#E8DCC4] text-[#2B2420] antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Suspense fallback={null}><ConversionAnalytics /></Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
