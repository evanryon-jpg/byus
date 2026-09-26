export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 30 * 60;

// Uploads can be any resolution up to 4K, but every video is stored and played at up to
// 1080p (Mux "basic" quality with a 1080p cap, see createDirectUpload in lib/mux.js):
// free to process, and far cheaper to store and stream than 4K. Sept 26, 2026.
export const VIDEO_LIMITS_LABEL =
  'Up to 30 minutes and 2 GB per video. MP4, MOV, WebM, or M4V; plays in up to 1080p HD.';

// Video storage per creator (Sept 26, 2026): 10 hours to start, plus 1 more hour for each
// paying member, up to 200 hours. Storing a minute of video costs ByUs about $0.003 a
// month, so an hour is about 18 cents; the extra hour each member brings is covered by
// ByUs's share of that member's payment many times over, while a brand-new creator still
// gets room for 20+ full-length videos before anyone has joined. Deleting a video frees
// its time. Checked when a new upload starts (lib/video-storage.js), so one upload can
// finish slightly past the line; after that, uploads wait until there's room again.
export const BASE_VIDEO_STORAGE_HOURS = 10;
export const VIDEO_STORAGE_HOURS_PER_MEMBER = 1;
export const MAX_VIDEO_STORAGE_HOURS = 200;

export function videoStorageLimitSeconds(payingMembers) {
  const hours = Math.min(
    MAX_VIDEO_STORAGE_HOURS,
    BASE_VIDEO_STORAGE_HOURS + VIDEO_STORAGE_HOURS_PER_MEMBER * Math.max(0, Number(payingMembers) || 0)
  );
  return hours * 3600;
}

export const VIDEO_STORAGE_RULE =
  '10 hours of video to start, plus 1 more hour for every paying member (up to 200 hours). Deleting a video frees up its time.';
