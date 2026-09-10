import { command, form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import { opinion, opinionTranslation } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
import { baseLocale, byLocale, contentLocales } from '#lib/locales';
import { getAdminOverview } from './admin-dashboard.remote';
import { listOpinions } from './site.remote';
import { idArg, optionalText, perLocale } from './schema';
import * as m from '#lib/paraglide/messages';

// The opinions behind the home page carousel. Two short fields per locale, a
// star rating and a position, so the whole domain is edited inline in one list
// rather than on a separate page per row.

const RATING_MIN = 1;
const RATING_MAX = 5;

type OpinionText = { locale: string; author: string; quote: string };

/**
 * One entry per known locale, keyed by locale. Returned as `Record<string, ...>`
 * rather than `Record<Locale, ...>` so the editor can index it with the locale
 * string its tab strip hands back.
 */
function textsByLocale(rows: OpinionText[]): Record<string, OpinionText> {
	return byLocale(rows, (locale) => ({ locale, author: '', quote: '' }));
}

export type AdminOpinion = Awaited<ReturnType<typeof listOpinionsForAdmin>>[number];

/** Every opinion, published or not, in carousel order. */
export const listOpinionsForAdmin = query(async () => {
	requireAdmin();

	const rows = await db
		.select({
			id: opinion.id,
			rating: opinion.rating,
			published: opinion.published
		})
		.from(opinion)
		.orderBy(asc(opinion.sortOrder), asc(opinion.createdAt));

	// Every translation in one read: the list is short, and a row per opinion
	// would cost a D1 round trip each.
	const translations = await db
		.select({
			opinionId: opinionTranslation.opinionId,
			locale: opinionTranslation.locale,
			author: opinionTranslation.author,
			quote: opinionTranslation.quote
		})
		.from(opinionTranslation);

	return rows.map((row) => ({
		...row,
		translations: textsByLocale(
			translations
				.filter((translation) => translation.opinionId === row.id)
				.map(({ locale, author, quote }) => ({ locale, author, quote }))
		)
	}));
});

/** Star count, 1 to 5. It arrives as a string because it comes from a `<select>`. */
const ratingArg = v.pipe(
	v.string(),
	v.transform((value) => Number(value)),
	v.check(
		(rating) => Number.isInteger(rating) && rating >= RATING_MIN && rating <= RATING_MAX,
		() => m.admin_error_generic()
	)
);

const saveOpinionSchema = v.object({
	// Empty on the "new opinion" card, a row id when an existing opinion is edited.
	id: optionalText(64),
	rating: ratingArg,
	// An unchecked checkbox submits nothing at all, so the field has to be optional.
	published: v.optional(v.boolean(), false),
	// Positional rather than spelled out per known locale, so adding a locale to
	// the project needs no change here - and positional rather than keyed by tag
	// because a hyphenated tag is not a valid form field path. See `perLocale`.
	translations: perLocale(v.object({ author: optionalText(120), quote: optionalText(1000) }))
});

export const saveOpinion = form(saveOpinionSchema, async (data, issue) => {
	requireAdmin();

	// The author is how an opinion is recognised, in the list and on the card, so
	// it is the one field that cannot be left blank. Only the locale whose tab is
	// open is submitted: an opinion saved from another tab keeps the author it was
	// stored with, while a new one has nothing to fall back on.
	const baseIndex = contentLocales.indexOf(baseLocale);
	const base = data.translations[baseIndex];
	const missingAuthor = base ? base.author === '' : !data.id;

	if (missingAuthor) {
		invalid(issue.translations[baseIndex].author(m.admin_required_field()));
	}

	const [row] = data.id
		? await db
				.update(opinion)
				.set({ rating: data.rating, published: data.published })
				.where(eq(opinion.id, data.id))
				.returning({ id: opinion.id })
		: await db
				.insert(opinion)
				.values({
					rating: data.rating,
					published: data.published,
					sortOrder: await nextSortOrder()
				})
				.returning({ id: opinion.id });

	// Nothing came back if the opinion was deleted in another tab between the
	// moment this screen loaded it and the moment it was saved.
	if (!row) invalid(m.admin_error_generic());

	// Only the locales the form actually carried are written. Writing every known
	// locale would blank the author and quote of every tab the editor did not
	// open, because the fields of an inactive tab are not in the submission at all.
	const translations = contentLocales.flatMap((locale, index) => {
		const text = data.translations[index];

		return text ? [{ opinionId: row.id, locale, author: text.author, quote: text.quote }] : [];
	});

	if (translations.length > 0) {
		await db
			.insert(opinionTranslation)
			.values(translations)
			.onConflictDoUpdate({
				target: [opinionTranslation.opinionId, opinionTranslation.locale],
				set: { author: sql`excluded.author`, quote: sql`excluded.quote` }
			});
	}

	await refreshOpinions();

	return { ok: true as const, id: row.id };
});

export const deleteOpinion = command(idArg, async (id) => {
	requireAdmin();

	// Deleted here rather than left to the schema's cascade, which SQLite only
	// applies when foreign keys are enabled on the connection.
	await db.delete(opinionTranslation).where(eq(opinionTranslation.opinionId, id));
	await db.delete(opinion).where(eq(opinion.id, id));

	await refreshOpinions();
});

export const moveOpinion = command(
	v.object({ id: idArg, direction: v.picklist(['up', 'down']) }),
	async ({ id, direction }) => {
		requireAdmin();

		const rows = await db
			.select({ id: opinion.id, sortOrder: opinion.sortOrder })
			.from(opinion)
			.orderBy(asc(opinion.sortOrder), asc(opinion.createdAt));

		const from = rows.findIndex((row) => row.id === id);
		const to = from + (direction === 'up' ? -1 : 1);

		if (from === -1 || to < 0 || to >= rows.length) return;

		const [moved] = rows.splice(from, 1);
		rows.splice(to, 0, moved);

		// Positions are rewritten rather than the two `sort_order` values swapped:
		// seeded and imported rows can share a value, and swapping equal numbers
		// would move nothing. Only the rows that actually shifted are written.
		await Promise.all(
			rows.map((row, position) =>
				row.sortOrder === position
					? null
					: db.update(opinion).set({ sortOrder: position }).where(eq(opinion.id, row.id))
			)
		);

		await refreshOpinions();
	}
);

/** New opinions join the end of the carousel. */
async function nextSortOrder(): Promise<number> {
	const [last] = await db
		.select({ value: sql<number>`coalesce(max(${opinion.sortOrder}), -1)` })
		.from(opinion);

	return Number(last?.value ?? -1) + 1;
}

/**
 * Everywhere a change to the opinions shows up: this screen's list, the
 * dashboard's counters, and the public carousel - which a client-side
 * navigation out of the panel would otherwise render from a stale cache.
 */
async function refreshOpinions(): Promise<void> {
	await Promise.all([
		listOpinionsForAdmin().refresh(),
		getAdminOverview().refresh(),
		...contentLocales.map((locale) => listOpinions(locale).refresh())
	]);
}
