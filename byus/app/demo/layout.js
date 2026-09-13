export const metadata = {
  title: 'Interactive Creator Demo — ByUs',
  description: 'Explore a fictional ByUs creator page and see the fan and creator experience without signing up.',
  alternates: { canonical: '/demo' },
};

export default function DemoLayout({ children }) {
  return (
    <div className="demo-route-scope">
      <style>{`
        .demo-route-scope [aria-hidden="true"].relative.h-32.overflow-hidden.bg-brand-paper {
          background-image:
            linear-gradient(rgba(15, 26, 22, 0.08), rgba(15, 26, 22, 0.18)),
            url('/images/demo/hero-landscape.jpg');
          background-size: cover;
          background-position: center 58%;
        }

        .demo-route-scope [aria-hidden="true"].relative.h-32.overflow-hidden.bg-brand-paper > div {
          display: none;
        }

        .demo-route-scope [aria-hidden="true"].relative.h-32.overflow-hidden.bg-brand-paper + div {
          position: relative;
          z-index: 1;
        }
      `}</style>
      {children}
    </div>
  );
}
