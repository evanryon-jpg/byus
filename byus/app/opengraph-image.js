import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ByUs — Creator subscriptions, simplified';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Reuse the actual app icon PNG directly, rather than re-drawing the mark as
  // separate shapes here -- guarantees this card always matches the real
  // favicon/app icon pixel-for-pixel instead of drifting out of sync with it.
  const iconData = await fetch(
    new URL('./icon.png', import.meta.url)
  ).then((res) => res.arrayBuffer());
  const iconBase64 = Buffer.from(iconData).toString('base64');
  const iconDataUri = `data:image/png;base64,${iconBase64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(15,118,110,0.16) 0%, rgba(15,118,110,0) 45%), radial-gradient(circle at 85% 15%, rgba(20,99,89,0.12) 0%, rgba(20,99,89,0) 45%)',
        }}
      >
        {/* The same mark used for the app icon -- "by us," not tied to any one
            creative medium, so it reads for any kind of creator. */}
        <img
          src={iconDataUri}
          width={120}
          height={120}
          style={{ display: 'flex', marginBottom: 40 }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 600,
            color: '#172033',
            letterSpacing: '-0.02em',
          }}
        >
          Creator subscriptions, simplified
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 32,
            color: 'rgba(0,0,0,0.55)',
          }}
        >
          87&ndash;90% direct payouts &middot; processing included &middot; cancel anytime
        </div>
      </div>
    ),
    { ...size }
  );
}
