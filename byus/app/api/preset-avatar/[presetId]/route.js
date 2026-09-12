import { NextResponse } from 'next/server';
import { isValidPresetAvatarId } from '@/lib/preset-avatars';
import sprite from '@/lib/avatar-sprite-100';

const TILE = 48;
const COLS = 8;
const SPRITE_WIDTH = 384;
const SPRITE_HEIGHT = 240;

export async function GET(request, { params }) {
  const { presetId } = params;
  if (!isValidPresetAvatarId(presetId)) {
    return NextResponse.json({ error: 'Avatar not found.' }, { status: 404 });
  }

  const index = Number(presetId.replace('avatar-', '')) - 1;
  const x = (index % COLS) * TILE;
  const y = Math.floor(index / COLS) * TILE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="${x} ${y} ${TILE} ${TILE}"><image href="data:image/webp;base64,${sprite}" width="${SPRITE_WIDTH}" height="${SPRITE_HEIGHT}"/></svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
