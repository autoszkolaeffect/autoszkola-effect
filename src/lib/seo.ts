import { localizeHref, type Locale } from '#lib/paraglide/runtime';
import * as m from '#lib/paraglide/messages';
import type { OgPage } from '../params';

// Head metadata helpers shared by the public pages, the site layout and the
// crawler-facing endpoints. Everything here is a pure function of its arguments -
// no `page` state, no request - so it behaves the same in a component, in a
// `+server.ts` and in the browser.

/** The static public pages with an Open Graph card; the list is the matcher's. */
export type { OgPage };

export type JsonLd = Record<string, unknown>;

const TITLE_SEPARATOR = ' | ';

/**
 * "Auto Szkoła Efekt | Blog". The site name leads so a crowded tab strip still
 * reads as the school's site; with no parts it is the name alone. Empty parts
 * are skipped, so a caller can pass an optional segment without checking it.
 */
export function pageTitle(...parts: string[]): string {
	return [m.site_name(), ...parts.filter((part) => part)].join(TITLE_SEPARATOR);
}

/**
 * `/og/pl/home.png` - the image `src/routes/og` draws for a static page. Pass
 * `version` for a card drawn from admin-edited content (the contact page): the
 * CDN and the social networks cache the image by URL for days, so a change to
 * the words has to change the URL too. The endpoint ignores the query.
 */
export function ogImageHref(
	origin: string,
	locale: string,
	page: OgPage,
	version?: Date | number | null
): string {
	return `${origin}/og/${locale}/${page}.png${versionQuery(version)}`;
}

/** `/og/pl/blog/<slug>.png` - one image per article, drawn from its title. */
export function ogArticleImageHref(
	origin: string,
	locale: string,
	slug: string,
	version?: Date | number | null
): string {
	return `${origin}/og/${locale}/blog/${encodeURIComponent(slug)}.png${versionQuery(version)}`;
}

function versionQuery(version: Date | number | null | undefined): string {
	if (version === null || version === undefined) return '';

	return `?v=${version instanceof Date ? version.getTime() : version}`;
}

/**
 * The logo as the plain file in `static/`, not the hashed Vite asset the pages
 * render: structured data is cached by crawlers for a long time, so it wants a
 * URL that survives a rebuild.
 */
export function logoHref(origin: string): string {
	return `${origin}/efekt-logo.jpg`;
}

/**
 * Absolute, localized URL for an un-localized route path -
 * `absoluteUrl(origin, '/blog')` is `https://…/pl/blog`. Goes through
 * `localizeHref` so the canonical can never disagree with the links on the page
 * about the prefix. Pass `locale` outside a page request, where the ambient
 * locale is the base one.
 */
export function absoluteUrl(origin: string, path: string, locale?: Locale): string {
	return new URL(localizeHref(path, { locale }), origin).href;
}

/**
 * Trims a description to what a search snippet shows. Blog excerpts are written
 * for the card, not the snippet, so they run long; the cut lands on a word
 * boundary and drops any separator it leaves dangling before the ellipsis.
 */
export function metaDescription(text: string, max = 160): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();

	if (collapsed.length <= max) return collapsed;

	const head = collapsed.slice(0, max - 1);
	const boundary = head.lastIndexOf(' ');
	const cut = boundary > 0 ? head.slice(0, boundary) : head;

	return `${cut.replace(/[-\s,;:.–]+$/, '')}…`;
}

/**
 * 'pl' -> 'pl_PL', the form `og:locale` takes. Intl supplies the likely region
 * for a bare language tag, so adding a locale needs no table entry here.
 */
export function ogLocale(locale: string): string {
	try {
		const { language, region } = new Intl.Locale(locale).maximize();
		return region ? `${language}_${region}` : language;
	} catch {
		return locale.replace('-', '_');
	}
}

/**
 * ISO 8601 for `article:published_time` and `datePublished`. `undefined` for an
 * unset date so `JSON.stringify` drops the property rather than emitting `null`.
 */
export function isoDate(value: Date | number | null | undefined): string | undefined {
	if (value === null || value === undefined) return undefined;

	return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * A `<script type="application/ld+json">` element for `{@html}`. Every `<` is
 * written as the JSON escape `\u003c`, which a JSON parser reads back as `<` but
 * the HTML parser never sees - so a `</script>` typed into an article title or
 * the address in the admin panel cannot close the element and turn the rest of
 * the payload into markup.
 */
export function jsonLdScript(data: JsonLd | JsonLd[]): string {
	const json = JSON.stringify(data).replace(/</g, '\\u003c');

	return `<script type="application/ld+json">${json}</script>`;
}
