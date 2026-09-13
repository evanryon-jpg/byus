'use client';

import { useEffect, useState } from 'react';

export default function FanDownloads() {
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    fetch('/api/fan/downloads')
      .then((res) => res.ok ? res.json() : { downloads: [] })
      .then((data) => setDownloads(data.downloads || []))
      .catch(() => {});
  }, []);

  if (!downloads.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Your downloads</h2>
      <p className="mt-1 text-sm text-brand-ink/65">PDFs you purchased are kept here for easy access.</p>
      <div className="mt-4 space-y-3">
        {downloads.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-ink/10 bg-brand-paper p-5">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-brand-ink/60">by {item.creator_name} · {item.file_name}</p>
            </div>
            <a href={item.download_url}
              className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white">
              Download PDF
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
