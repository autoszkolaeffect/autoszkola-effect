import type { RequestHandler } from './$types';

// Served by a route rather than a file in static/ only so the Sitemap line can
// carry the origin the request arrived on: a sitemap URL has to be absolute, and
// a preview deployment must not point crawlers at production.
//
// Nothing is disallowed, and that includes the admin panel. It is kept out of
// the index by the `noindex` header and meta tag every response under /admin
// carries - and a crawler can only honour those on a page it is allowed to
// fetch. A Disallow here would hide the very signal that keeps a linked-to
// /admin URL from showing up as a bare, description-less result.

export const GET: RequestHandler = ({ url }) => {
	const body = [
		'User-agent: *',
		'Disallow:',
		'',
		`Sitemap: ${new URL('/sitemap.xml', url.origin).href}`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};
