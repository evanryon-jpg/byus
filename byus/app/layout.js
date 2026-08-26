import './globals.css';

export const metadata = {
  title: 'ByUs — Creator subscriptions, simplified',
  description: 'Support creators you love. Creators keep 90% of every payment.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF8F4] text-[#1A1A1A] antialiased">
        <nav className="border-b border-black/5 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="text-xl font-bold text-[#146359]">ByUs</a>
            <div className="flex items-center gap-6 text-sm font-medium">
              <a href="/browse" className="hover:text-[#146359]">Browse creators</a>
              <a href="/login" className="hover:text-[#146359]">Log in</a>
              <a
                href="/signup"
                className="rounded-full bg-[#146359] px-4 py-2 text-white hover:bg-[#0f4d45]"
              >
                Sign up
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
