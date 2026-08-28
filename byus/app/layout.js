import './globals.css';
import NavBar from './components/NavBar';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'ByUs — Creator subscriptions, simplified',
  description: 'Support creators you love. Creators keep 90% of every payment.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF8F4] text-[#1A1A1A] antialiased">
        <NavBar />
        <main>{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
