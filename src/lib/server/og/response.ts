/**
 * Wraps a rendered card for the wire.
 *
 * A card changes only when its content does, and content changes are rare, so
 * the CDN keeps it for a day and browsers for an hour; after that a stale copy
 * is served while a fresh one renders, for up to a week. Crawlers fetching the
 * image for a link preview never wait on satori twice for the same page.
 */
export function ogImageResponse(png: Uint8Array<ArrayBuffer>): Response {
	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
		}
	});
}
