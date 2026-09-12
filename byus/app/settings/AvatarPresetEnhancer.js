'use client';

import { useEffect } from 'react';

const AVATAR_ASSET_VERSION = '4';

export default function AvatarPresetEnhancer() {
  useEffect(() => {
    function replacePresetSources() {
      document.querySelectorAll('img[src^="/images/avatars/avatar-"]').forEach((img) => {
        const match = img.getAttribute('src')?.match(/\/images\/avatars\/(avatar-\d+)\.svg$/);
        if (match) img.src = `/api/preset-avatar/${match[1]}?v=${AVATAR_ASSET_VERSION}`;
      });
    }

    replacePresetSources();
    const observer = new MutationObserver(replacePresetSources);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
