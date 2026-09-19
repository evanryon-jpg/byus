// Auto-served at /sitemap.xml by Next.js's file-based sitemap convention -- nothing
// else needs to reference this file. Kept dynamic (not statically generated at build
// time) so a newly-claimed creator slug shows up the next time Google fetches this
// without waiting on a redeploy; the cost of a DB query per crawl is negligible next
// to how infrequently Google actually re-requests a sitemap.
export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { HELP_CATEGORIES } from './help/data';

const BASE_URL = 'https://byusapp.com';

// Marketing/content pages worth surfacing in search. Deliberately leaves out
// account-action routes (login, signup, settings, dashboards, admin) -- see
// app/robots.js, which disallows crawling those outright.
const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/discover', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/browse', changeFrequency: 'daily', priority: 0.8 },
  { path: '/bloggers', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/instagram', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/demo', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/help', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const helpEntries = HELP_CATEGORIES.map((category) => ({
    url: `${BASE_URL}/help/${category.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  // Public creator profile pages -- every live, non-suspended creator who's claimed a
  // vanity URL. A creator with no slug yet is only reachable by UUID, which isn't a
  // link worth indexing, and a suspended creator shouldn't surface in search at all.
  let creatorEntries = [];
  try {
    const result = await query(
      `SELECT slug, updated_at FROM users
       WHERE role = 'creator' AND is_suspended = false AND slug IS NOT NULL`
    );
    creatorEntries = result.rows.map((row) => ({
      url: `${BASE_URL}/creator/${row.slug}`,
      lastModified: row.updated_at || now,
      changeFrequency: 'daily',
      priority: 0.7,
    }));
  } catch (err) {
    // A DB hiccup shouldn't take down the whole sitemap -- Google still gets the
    // static/help routes above, and this gets picked up again on the next crawl.
    console.error('sitemap: failed to load creator routes (continuing without them):', err);
  }

  return [...staticEntries, ...helpEntries, ...creatorEntries];
}
