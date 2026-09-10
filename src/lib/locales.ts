import { baseLocale, locales, type Locale } from '#lib/paraglide/runtime';

/**
 * The locales the app is compiled for, in a stable order with the base locale
 * first. Adding a locale to `project.inlang/settings.json` is the only change
 * needed - every editor in the admin panel and every content query reads this
 * list rather than hard-coding `pl`.
 */
export const contentLocales: readonly Locale[] = [
	baseLocale,
	...locales.filter((locale) => locale !== baseLocale)
];

export { baseLocale, type Locale };

/**
 * A locale's position in `contentLocales`, which is how per-locale form fields
 * are addressed - `text[0].pageTitle` rather than `text.pl.pageTitle`, because a
 * hyphenated tag like `en-GB` is not a valid form field path. Takes a plain
 * string so it can be handed the tab argument `LocaleTabs` yields.
 */
export function indexOfLocale(locale: string): number {
	return contentLocales.findIndex((known) => known === locale);
}

/** Human-readable name of a locale, in that locale's own language. */
export function localeName(locale: Locale): string {
	try {
		return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale.toUpperCase();
	} catch {
		return locale.toUpperCase();
	}
}

/**
 * Indexes translation rows by locale and fills the gaps, so callers always get
 * exactly one entry per known locale. A locale added after some content was
 * written has no rows in the database yet; rather than migrating every table,
 * the missing rows are synthesised here and persisted the next time that piece
 * of content is saved.
 */
export function byLocale<T extends { locale: string }>(
	rows: readonly T[],
	empty: (locale: Locale) => T
): Record<Locale, T> {
	const found = new Map(rows.map((row) => [row.locale, row]));

	return Object.fromEntries(
		contentLocales.map((locale) => [locale, found.get(locale) ?? empty(locale)])
	) as Record<Locale, T>;
}

/**
 * Picks the translation for `locale`, falling back to the base locale and then
 * to any translation that exists. Content authored before a locale was added
 * still renders something rather than a blank page.
 */
export function pickTranslation<T extends { locale: string }>(
	rows: readonly T[],
	locale: Locale
): T | undefined {
	return (
		rows.find((row) => row.locale === locale) ??
		rows.find((row) => row.locale === baseLocale) ??
		rows[0]
	);
}
