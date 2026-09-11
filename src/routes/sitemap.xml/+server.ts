import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { baseLocale, contentLocales, type Locale } from '#lib/locales';
import { localizeHref } from '#lib/paraglide/runtime';
import { db } from '#lib/server/db';
import { blogPost, blogPostTranslation } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

// Generated per request rather than at build time: articles are published from
// the admin panel without a deploy, so a sitemap baked into the build would go
// stale the first time an editor pressed "publish". The CDN holds it for an hour
// instead, and serves the held copy for a day while a fresh one is fetched.
//
// /sitemap.xml is excluded from Paraglide's URL strategy, so the ambient locale
// in here is always the base locale - every href below names its locale itself.

const STATIC_PAGES = ['/', '/instructors', '/blog', '/contact'] as const;

export const GET: RequestHandler = async ({ url }) => {
	// Keyed by absolute URL so a slug that resolves the same way for two locales is
	// listed once. `null` means no <lastmod>: nothing records when a static page
	// last changed, and an invented date would only teach crawlers to distrust
	// the real ones on the articles.
	const entries = new Map<string, Date | null>();

	const add = (path: string, locale: Locale, lastmod: Date | null) => {
		const loc = new URL(localizeHref(path, { locale }), url.origin).href;

		if (!entries.has(loc)) entries.set(loc, lastmod);
	};

	for (const locale of contentLocales) {
		for (const path of STATIC_PAGES) add(path, locale, null);

		for (const post of await publishedPosts(locale)) {
			add(`/blog/${encodeURIComponent(post.slug)}`, locale, post.updatedAt);
		}
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...[...entries].map(([loc, lastmod]) => urlElement(loc, lastmod)),
		'</urlset>',
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};

/**
 * The same slug fallback `listBlogPosts` builds its cards from, so every article
 * URL listed here is one the blog page really links to. A post with no slug in
 * either the requested or the base locale cannot be reached and is left out.
 */
async function publishedPosts(locale: Locale): Promise<{ slug: string; updatedAt: Date }[]> {
	const requested = alias(blogPostTranslation, 'requested');
	const fallback = alias(blogPostTranslation, 'fallback');

	const rows = await db
		.select({
			slug: sql<string>`coalesce(nullif(${requested.slug}, ''), nullif(${fallback.slug}, ''), '')`,
			updatedAt: blogPost.updatedAt
		})
		.from(blogPost)
		.leftJoin(requested, and(eq(requested.postId, blogPost.id), eq(requested.locale, locale)))
		.leftJoin(fallback, and(eq(fallback.postId, blogPost.id), eq(fallback.locale, baseLocale)))
		.where(and(eq(blogPost.status, 'published'), isNotNull(blogPost.publishedAt)))
		.orderBy(desc(blogPost.publishedAt));

	return rows.filter((row) => row.slug);
}

function urlElement(loc: string, lastmod: Date | null): string {
	const lines = [`\t\t<loc>${escapeXml(loc)}</loc>`];

	if (lastmod) lines.push(`\t\t<lastmod>${lastmod.toISOString()}</lastmod>`);

	return ['\t<url>', ...lines, '\t</url>'].join('\n');
}

// Slugs are admin-authored and land inside an element, so the five characters
// XML gives a meaning to are escaped rather than trusted.
function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
