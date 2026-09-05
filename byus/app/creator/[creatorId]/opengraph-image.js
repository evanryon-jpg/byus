export const dynamic = 'force-dynamic';

// Per-creator share-card image, generated on request. Whoever opens a creator's
// shared link sees their name, photo (or a lettered avatar if they haven't set
// one), and bio right there in the preview -- the same "who is this and why
// should I care" a real profile card gives, instead of a blank/generic link.
// Needs a real DB round-trip (the `pg` client, not edge-compatible), so this
// runs on the default Node.js runtime rather than opting into edge like the
// site-wide app/opengraph-image.js does.

import { ImageResponse } from 'next/og';
import { resolveCreator } from '@/lib/resolve-creator';
import { publicAvatarUrl } from '@/lib/avatar-url';

export const alt = 'Creator profile on ByUs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.APP_URL || 'https://byus-ten.vercel.app';

export default async function Image({ params }) {
  // Same badge mark as the homepage's share card -- keeps every ByUs link,
  // whether it's the homepage or one creator's page, recognizable as the same
  // brand at a glance in a crowded feed or DM thread. The site-wide
  // app/opengraph-image.js can read this file straight off disk via
  // `new URL('./icon.png', import.meta.url)` because it opts into the edge
  // runtime; that trick doesn't resolve to a fetchable URL under the Node.js
  // runtime this route needs for its DB lookup, so fetch the same file over
  // HTTP instead -- `app/icon.png` is already served publicly at /icon.png
  // as Next's favicon convention.
  const iconData = await fetch(`${SITE_URL}/icon.png`).then((res) => res.arrayBuffer());
  const iconDataUri = `data:image/png;base64,${Buffer.from(iconData).toString('base64')}`;

  const creator = await resolveCreator(params.creatorId, 'id, display_name, bio, profile_image_url');

  if (!creator) {
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
            backgroundColor: '#E8DCC4',
          }}
        >
          <img src={iconDataUri} width={100} height={100} style={{ display: 'flex', marginBottom: 32 }} />
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 600, color: '#2B2420' }}>
            Creator not found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const initial = (creator.display_name || '?').trim().charAt(0).toUpperCase();
  const bio = creator.bio && creator.bio.length > 140 ? `${creator.bio.slice(0, 139)}…` : creator.bio;
  // profile_image_url in the DB is a private Blob pathname -- point Satori (the
  // renderer behind ImageResponse) at our own public avatar proxy instead, the
  // same one every other public-facing avatar on the site already goes through.
  const avatarPath = publicAvatarUrl(creator.id, creator.profile_image_url);
  const avatarUrl = avatarPath ? `${SITE_URL}${avatarPath}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 88px',
          backgroundColor: '#E8DCC4',
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(201,169,97,0.22) 0%, rgba(201,169,97,0) 45%), radial-gradient(circle at 88% 82%, rgba(20,99,89,0.14) 0%, rgba(20,99,89,0) 45%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={iconDataUri} width={40} height={40} style={{ display: 'flex' }} />
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: '#146359' }}>ByUs</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              width={220}
              height={220}
              style={{ display: 'flex', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: 220,
                height: 220,
                borderRadius: '50%',
                backgroundColor: 'rgba(20,99,89,0.1)',
                color: '#146359',
                fontSize: 96,
                fontWeight: 600,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {initial}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                fontWeight: 600,
                color: '#2B2420',
                letterSpacing: '-0.02em',
              }}
            >
              {creator.display_name}
            </div>
            {bio && (
              <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: 'rgba(0,0,0,0.6)', lineHeight: 1.4 }}>
                {bio}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: 'rgba(0,0,0,0.45)' }}>
          Subscribe at byusapp.com
        </div>
      </div>
    ),
    { ...size }
  );
}
