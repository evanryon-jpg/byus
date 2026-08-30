import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ByUs — Creator subscriptions, simplified';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
            color: 'white',
            fontSize: 72,
            fontWeight: 700,
            marginBottom: 40,
          }}
        >
          B
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
    { ...size }
  );
}
