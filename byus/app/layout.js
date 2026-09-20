import './globals.css';
import { Suspense } from 'react';
import { Caveat, Fraunces, Karla } from 'next/font/google';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ConversionAnalytics from './components/ConversionAnalytics';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700', '800'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const karla = Karla({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: ['500'], variable: '--font-script', display: 'swap' });
const SITE_URL = process.env.APP_URL || 'https://byus-ten.vercel.app';

export const viewport = { themeColor: '#0F766E' };
// Title and description both lead with "ByUs" / "ByUs App" by name -- ByUs is close
// enough in spelling to "BYU" and "by us" that search engines can misread it as a typo
// of one or the other. Naming the app explicitly here, in the on-page headers below,
// and in the "What is ByUs?" FAQ entry (app/components/faqs-data.js) is how the site
// establishes itself as its own distinct, correctly-spelled entity rather than relying
// on backlinks or age alone.
const SITE_TITLE = 'ByUs App | Creator Subscriptions, Simplified';
const SITE_DESCRIPTION =
  'ByUs (byusapp.com) is a creator membership platform. Join ByUs to support creators directly, or start your own ByUs page — creators keep 87–90% of every subscription payment.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'ByUs',
    'ByUs app',
    'byusapp.com',
    'creator subscription platform',
    'creator membership platform',
    'Patreon alternative',
    'Ko-fi alternative',
    'low fee membership platform',
    'direct Stripe payouts for creators',
    'independent creator monetization',
  ],
  alternates: { canonical: '/' },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL, siteName: 'ByUs', type: 'website' },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable} ${caveat.variable}`}>
      <body className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#172033] antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Suspense fallback={null}><ConversionAnalytics /></Suspense>
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
