'use client';

import { useEffect } from 'react';

export default function AvatarPresetEnhancer() {
  useEffect(() => {
    function replacePresetSources() {
      document.querySelectorAll('img[src^="/images/avatars/avatar-"]').forEach((img) => {
        const match = img.getAttribute('src')?.match(/\/images\/avatars\/(avatar-\d+)\.svg$/);
        if (match) img.src = `/api/preset-avatar/${match[1]}`;
      });
    }

    replacePresetSources();
    const observer = new MutationObserver(replacePresetSources);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
