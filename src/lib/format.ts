import { getLocale } from '#lib/paraglide/runtime';

/**
 * "12 marca 2024" - the long, declined form the design uses for post dates.
 * Intl gives the correct genitive month name for Polish without a lookup table.
 */
export function formatLongDate(
	value: Date | number | null | undefined,
	locale = getLocale()
): string {
	if (value === null || value === undefined) return '';

	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(value instanceof Date ? value : new Date(value));
}

/** "12.03.2024, 14:05" - compact form for admin lists. */
export function formatDateTime(
	value: Date | number | null | undefined,
	locale = getLocale()
): string {
	if (value === null || value === undefined) return '';

	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(value instanceof Date ? value : new Date(value));
}

/**
 * "4,5" - a star rating for a label. Polish writes the decimal with a comma, and
 * a whole rating reads as "5" rather than "5,0", which is why this goes through
 * Intl instead of `toFixed`.
 */
export function formatRating(value: number, locale = getLocale()): string {
	return new Intl.NumberFormat(locale).format(value);
}

/** `2024-03-12`, for `<input type="date">`. */
export function toDateInputValue(value: Date | number | null | undefined): string {
	if (value === null || value === undefined) return '';

	const date = value instanceof Date ? value : new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Turns a title into a URL-safe slug, mapping Polish diacritics to their ASCII
 * counterparts first so "Newralgiczne miejsca w Łodzi" becomes
 * "newralgiczne-miejsca-w-lodzi" rather than losing the Ł entirely.
 */
export function slugify(value: string): string {
	const polish: Record<string, string> = {
		ą: 'a',
		ć: 'c',
		ę: 'e',
		ł: 'l',
		ń: 'n',
		ó: 'o',
		ś: 's',
		ź: 'z',
		ż: 'z',
		Ą: 'a',
		Ć: 'c',
		Ę: 'e',
		Ł: 'l',
		Ń: 'n',
		Ó: 'o',
		Ś: 's',
		Ź: 'z',
		Ż: 'z'
	};

	return (
		value
			.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polish[char] ?? char)
			// NFD splits any remaining accented letter into base + combining mark, and
			// the next line drops the marks. ̀-ͯ is the combining range.
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80)
	);
}

/** `tel:` href with everything but digits and a leading `+` stripped. */
export function telHref(number: string): string {
	return `tel:${number.replace(/[^\d+]/g, '')}`;
}
