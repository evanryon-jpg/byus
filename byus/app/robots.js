// Auto-served at /robots.txt by Next.js's file-based robots convention -- nothing else
// needs to reference this file. Disallows only routes with no search-relevant content:
// admin tooling, and pages that only mean anything to an already-logged-in account
// (settings, dashboards, onboarding, password reset). Marketing and discovery pages,
// and public creator profiles, stay crawlable.
//
// Deliberately NOT disallowing /api/: public pages like /discover, /browse, and
// /creator/[creatorId] are client components that fetch their actual content from
// API routes at render time. Googlebot's renderer honors robots.txt for those
// subresource fetches too, not just top-level page crawls -- disallowing /api/
// meant Googlebot could load the page shell but was blocked from fetching the data
// that fills it, so it saw an empty feed / error state and flagged the page as a
// soft 404 (confirmed live via Search Console's URL Inspection on /discover:
// Vercel's logs show the page request landing but no matching /api/discover request
// at all at that timestamp). API responses are JSON with no title/meta/content of
// their own, so leaving them crawlable doesn't create any indexing risk in exchange.
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/',
        '/settings',
        '/creator/dashboard',
        '/creator/onboarding',
        '/fan/dashboard',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: 'https://www.byusapp.com/sitemap.xml',
  };
}
