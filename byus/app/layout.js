import './globals.css';
import { Fraunces } from 'next/font/google';
import NavBar from './components/NavBar';
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

export const metadata = {
  title: 'ByUs — Creator subscriptions, simplified',
  description: 'Support creators you love. Creators keep 90% of every payment.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-[#FAF8F4] text-[#1A1A1A] antialiased">
        <NavBar />
        <main>{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
