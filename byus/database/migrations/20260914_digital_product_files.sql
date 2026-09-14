-- Digital products move from "one row = one file" to "one row = one or more files",
-- so musicians/filmmakers/preset sellers can bundle several files (audio, video,
-- archives, images) under a single listing instead of being stuck with a single
-- PDF-only download. digital_products is empty in production (0 rows) as of this
-- migration, so this is a clean cut -- no backfill needed.
--
-- The old file_url/file_name/file_size_bytes columns move off digital_products and
-- onto this new child table, one row per file. content_type is stored verbatim
-- (validated server-side against lib/product-files.js's allow-list on write); kind is
-- a coarse bucket ('pdf' | 'audio' | 'video' | 'archive' | 'image') derived from it at
-- write time, so the UI can show a file-type icon without re-parsing content_type.
ALTER TABLE digital_products
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS file_name,
  DROP COLUMN IF EXISTS file_size_bytes;

CREATE TABLE IF NOT EXISTS digital_product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  content_type text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pdf', 'audio', 'video', 'archive', 'image')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_product_files_product
  ON digital_product_files (product_id, position);
