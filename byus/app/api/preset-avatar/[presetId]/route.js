import { NextResponse } from 'next/server';
import { isValidPresetAvatarId } from '@/lib/preset-avatars';
import sprite0 from '@/lib/avatar-sprite-0';
import sprite1 from '@/lib/avatar-sprite-1';
import sprite2 from '@/lib/avatar-sprite-2';

const SPRITE = `${sprite0}${sprite1}${sprite2}`;
const TILE = 48;
const COLS = 8;

export async function GET(request, { params }) {
  const { presetId } = params;
  if (!isValidPresetAvatarId(presetId)) {
    return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 });
  }

  const index = Number(presetId.replace('avatar-', '')) - 1;
  const x = (index % COLS) * TILE;
  const y = Math.floor(index / COLS) * TILE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="${x} ${y} ${TILE} ${TILE}"><image href="data:image/webp;base64,${SPRITE}" width="384" height="240"/></svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
