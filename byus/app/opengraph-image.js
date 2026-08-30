import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ByUs — Creator subscriptions, simplified';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const fontData = await fetch(
    new URL('./fonts/Fraunces-Italic-Black9.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer());

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
          backgroundColor: '#FAF8F4',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(201,169,97,0.25) 0%, rgba(201,169,97,0) 45%), radial-gradient(circle at 85% 15%, rgba(20,99,89,0.12) 0%, rgba(20,99,89,0) 45%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 28,
            backgroundColor: '#146359',
            marginBottom: 40,
          }}
        >
          {/* The same ampersand mark used for the app icon -- "by us", not tied to
              any one creative medium, so it reads for any kind of creator. */}
          <div
            style={{
              display: 'flex',
              fontFamily: 'Fraunces Italic Black',
              fontSize: 92,
              color: '#FAF8F4',
              lineHeight: 1,
              transform: 'translateY(-4px)',
            }}
          >
            &amp;
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 600,
            color: '#1A1A1A',
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
          90% direct payouts &middot; flat 10% fee &middot; cancel anytime
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Fraunces Italic Black',
          data: fontData,
          style: 'italic',
          weight: 900,
        },
      ],
    }
  );
}
