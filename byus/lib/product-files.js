// Shared allow-list for digital product files -- used by the Blob client-upload
// token route (server-side gate on what's allowed to reach storage at all) and the
// product-creation route (defense in depth: never trust the content type or size a
// client claims after the fact). Extending "digital products" past PDF-only to
// audio/video/archives/images means this single map is the one place that changes
// to support a new file type everywhere at once.
//
// maxBytes per type is a product/cost decision, not a platform ceiling -- Vercel
// Blob's client-upload path (see app/api/creator/products/upload-token/route.js)
// handles multipart uploads up to several TB, so these caps exist to keep storage
// costs predictable at ByUs's current scale, not because of a technical limit.
export const ALLOWED_FILE_TYPES = {
  'application/pdf': { ext: 'pdf', kind: 'pdf', maxBytes: 25 * 1024 * 1024 },
  'audio/mpeg': { ext: 'mp3', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'audio/wav': { ext: 'wav', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'audio/x-wav': { ext: 'wav', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'audio/mp4': { ext: 'm4a', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'audio/aac': { ext: 'aac', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'audio/flac': { ext: 'flac', kind: 'audio', maxBytes: 200 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', kind: 'video', maxBytes: 1024 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', kind: 'video', maxBytes: 1024 * 1024 * 1024 },
  'video/webm': { ext: 'webm', kind: 'video', maxBytes: 1024 * 1024 * 1024 },
  'application/zip': { ext: 'zip', kind: 'archive', maxBytes: 500 * 1024 * 1024 },
  'application/x-zip-compressed': { ext: 'zip', kind: 'archive', maxBytes: 500 * 1024 * 1024 },
  'image/png': { ext: 'png', kind: 'image', maxBytes: 25 * 1024 * 1024 },
  'image/jpeg': { ext: 'jpg', kind: 'image', maxBytes: 25 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image', maxBytes: 25 * 1024 * 1024 },
};

export const ALLOWED_CONTENT_TYPES = Object.keys(ALLOWED_FILE_TYPES);

// The 'accept' attribute for the creator-facing file picker, grouped for readability.
export const ACCEPT_ATTR = ALLOWED_CONTENT_TYPES.join(',');

export const MAX_FILES_PER_PRODUCT = 10;

export function classifyFile(contentType, sizeBytes) {
  const spec = ALLOWED_FILE_TYPES[contentType];
  if (!spec) return { ok: false, error: `Unsupported file type: ${contentType || 'unknown'}.` };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (sizeBytes > spec.maxBytes) {
    return { ok: false, error: `${spec.kind} files must be ${(spec.maxBytes / (1024 * 1024)).toFixed(0)}MB or smaller.` };
  }
  return { ok: true, kind: spec.kind, ext: spec.ext };
}

const KIND_LABELS = {
  pdf: 'PDF',
  audio: 'Audio',
  video: 'Video',
  archive: 'Archive',
  image: 'Image',
};

export function kindLabel(kind) {
  return KIND_LABELS[kind] || 'File';
}
