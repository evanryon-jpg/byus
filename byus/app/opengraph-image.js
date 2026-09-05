import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ByUs — Creator subscriptions, simplified';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Reuse the actual app icon PNG as the badge image, rather than re-rendering the
  // ampersand as live text. Satori (the renderer behind ImageResponse) does full
  // OpenType shaping and picks up Fraunces' contextual swash-ampersand alternate --
  // a fancier glyph than the plain one baked into icon.png -- so the two renderers
  // disagreed on which glyph "&" means. Using the icon file directly guarantees this
  // card always matches the real favicon/app icon pixel-for-pixel.
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
          backgroundColor: '#FAF8F4',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(201,169,97,0.25) 0%, rgba(201,169,97,0) 45%), radial-gradient(circle at 85% 15%, rgba(20,99,89,0.12) 0%, rgba(20,99,89,0) 45%)',
        }}
      >
        {/* The same ampersand mark used for the app icon -- "by us", not tied to any
            one creative medium, so it reads for any kind of creator. */}
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
            color: '#2B2420',
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
          90%+ direct payouts &middot; fee drops as you grow &middot; cancel anytime
        </div>
      </div>
    ),
    { ...size }
  );
}
