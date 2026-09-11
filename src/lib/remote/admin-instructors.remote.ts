import { command, form, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { asc, eq, inArray, max, sql } from 'drizzle-orm';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import { instructor, instructorTranslation } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
import { instructorAccentHex, isAccentHex } from '#lib/accents';
import { baseLocale, byLocale, contentLocales } from '#lib/locales';
import { localizeHref } from '#lib/paraglide/runtime';
import { MAX_PHOTO_BYTES, isPhotoDataUrl, photoByteLength } from '#lib/photo';
import { getAdminOverview } from './admin-dashboard.remote';
import { listInstructors } from './site.remote';
import { idArg, localeArg, optionalText } from './schema';
import * as m from '#lib/paraglide/messages';

// The admin side of the instructor grid. Unlike `listInstructors` in
// site.remote.ts these read every locale at once - the editor shows one section
// per entry in `contentLocales` - and they never fall back between locales,
// because an editor has to see which translations are actually missing.

/**
 * The public grid, which a client-side navigation out of the panel would
 * otherwise render from the cache the visitor's session filled before the edit.
 * Every mutation here changes what that grid shows - the order, the published
 * flag and the stored accent included, since the first two decide which cards
 * appear and which colour of the cycle falls to each, and the third overrides
 * that colour outright.
 */
async function refreshPublicInstructors(): Promise<void> {
	await Promise.all(contentLocales.map((locale) => listInstructors(locale).refresh()));
}

/**
 * The editors of `ids`. `getInstructorForAdmin` reads `autoAccent` off the
 * row's position in the grid, so an editor cached before the grid moved offers
 * "Automatyczny (wg pozycji)" in a colour the card no longer takes.
 */
async function refreshInstructorEditors(ids: string[]): Promise<void> {
	await Promise.all(ids.map((id) => getInstructorForAdmin(id).refresh()));
}

/**
 * The same, for every instructor from `id`'s place in the grid to the end:
 * `id` because it was just written, and the rest because showing or hiding a
 * row moves everything after it one step along the accent cycle. The rows
 * ahead of it keep the position they had, so their editors are still good.
 */
async function refreshInstructorEditorsFrom(id: string): Promise<void> {
	const rows = await db
		.select({ id: instructor.id })
		.from(instructor)
		.orderBy(asc(instructor.sortOrder), asc(instructor.createdAt));

	const index = rows.findIndex((row) => row.id === id);
	// Missing when the write was the delete itself, or if the row went away
	// between the write and this refresh. The grid is a handful of rows, so
	// refresh the lot rather than guess where it sat.
	const shifted = index === -1 ? rows : rows.slice(index);

	await refreshInstructorEditors(shifted.map((row) => row.id));
}

/* ------------------------------------------------------------------- reading */

export type AdminInstructorListItem = Awaited<ReturnType<typeof listInstructorsForAdmin>>[number];

export const listInstructorsForAdmin = query(async () => {
	requireAdmin();

	const rows = await db
		.select({
			id: instructor.id,
			published: instructor.published,
			accent: instructor.accent,
			// Deliberately not the photo itself: five 100 KB base64 URLs would make
			// this list several megabytes, and all it has to say is whether one is
			// set. The editor fetches the real thing for one instructor at a time.
			hasPhoto: sql<number>`length(coalesce(${instructor.photo}, '')) > 0`
		})
		.from(instructor)
		.orderBy(asc(instructor.sortOrder), asc(instructor.createdAt));

	if (rows.length === 0) return [];

	const translations = await db
		.select({
			instructorId: instructorTranslation.instructorId,
			locale: instructorTranslation.locale,
			name: instructorTranslation.name,
			badge: instructorTranslation.badge
		})
		.from(instructorTranslation)
		.where(inArray(instructorTranslation.locale, [...contentLocales]));

	const grouped = new Map<string, { locale: string; name: string; badge: string }[]>();

	for (const { instructorId, ...translation } of translations) {
		const list = grouped.get(instructorId) ?? [];
		list.push(translation);
		grouped.set(instructorId, list);
	}

	return rows.map((row) => ({
		id: row.id,
		published: row.published,
		// The raw stored value, not a resolved colour: the fallback depends on the
		// row's position among the published instructors, which the list screen
		// works out for itself while it renders them.
		accent: row.accent,
		hasPhoto: Boolean(row.hasPhoto),
		translations: byLocale(grouped.get(row.id) ?? [], (locale) => ({
			locale,
			name: '',
			badge: ''
		}))
	}));
});

export type AdminInstructor = NonNullable<Awaited<ReturnType<typeof getInstructorForAdmin>>>;

export const getInstructorForAdmin = query(idArg, async (id) => {
	requireAdmin();

	const [row] = await db
		.select({
			id: instructor.id,
			photo: instructor.photo,
			accent: instructor.accent,
			published: instructor.published
		})
		.from(instructor)
		.where(eq(instructor.id, id))
		.limit(1);

	if (!row) return null;

	// Every instructor in the order `listInstructors` renders the published ones,
	// because the picker has to show which colour "automatic" currently means and
	// position is the only thing that decides it. Ids and the flag alone, and a
	// query of its own rather than a join: anything wider pulls every
	// instructor's base64 photo along.
	const grid = await db
		.select({ id: instructor.id, published: instructor.published })
		.from(instructor)
		.orderBy(asc(instructor.sortOrder), asc(instructor.createdAt));

	// The position among the published rows counting this one as published too.
	// A hidden instructor re-enters the grid at its own `sortOrder` rather than
	// at the end, so this is the colour its card takes the moment it is shown -
	// and for a row that is already published it is just its position.
	const position = grid
		.filter((entry) => entry.published || entry.id === id)
		.findIndex((entry) => entry.id === id);
	const autoAccent = instructorAccentHex(null, position);

	const translations = await db
		.select({
			locale: instructorTranslation.locale,
			name: instructorTranslation.name,
			badge: instructorTranslation.badge,
			experience: instructorTranslation.experience,
			bio: instructorTranslation.bio
		})
		.from(instructorTranslation)
		.where(eq(instructorTranslation.instructorId, id));

	return {
		...row,
		autoAccent,
		// A locale added after this instructor was written has no row yet, so the
		// editor is handed an empty one to fill in and `saveInstructor` persists it.
		translations: byLocale(translations, (locale) => ({
			locale,
			name: '',
			badge: '',
			experience: '',
			bio: ''
		}))
	};
});

/* ------------------------------------------------------------------- writing */

// The messages are thunks: these schemas are built once when the module loads,
// outside any request, so calling a message function here would bake in
// whichever locale happened to be ambient at import time.
const photoArg = v.pipe(
	v.string(),
	v.trim(),
	v.check(
		(value) => photoByteLength(value) <= MAX_PHOTO_BYTES,
		() => m.admin_instructors_photo_too_large()
	),
	v.check(
		(value) => value === '' || isPhotoDataUrl(value),
		() => m.admin_instructors_photo_invalid()
	)
);

// Empty is the editor's "automatic", stored as NULL; anything else has to be a
// colour CSS takes verbatim. Lower-cased so `#F5EB18` and `#f5eb18` are one
// stored value rather than two that compare unequal.
const accentArg = v.pipe(
	v.string(),
	v.trim(),
	v.toLowerCase(),
	v.check(
		(value) => value === '' || isAccentHex(value),
		() => m.admin_instructors_accent_invalid()
	)
);

const saveSchema = v.object({
	// Empty when the form is creating rather than editing.
	id: v.pipe(v.string(), v.maxLength(64)),
	// Which locale of the panel the editor is working in, so the redirect after
	// saving lands on the localized list rather than the base locale's.
	locale: localeArg,
	published: v.optional(v.boolean(), false),
	photo: photoArg,
	accent: accentArg,
	translations: v.pipe(
		v.array(
			v.object({
				locale: localeArg,
				name: optionalText(160),
				badge: optionalText(160),
				experience: optionalText(160),
				bio: optionalText(4000)
			})
		),
		v.check(
			(entries) => contentLocales.every((locale) => entries.some((e) => e.locale === locale)),
			// Only reachable from a hand-made request: the form always renders a
			// section per locale.
			() => m.admin_error_generic()
		)
	)
});

export const saveInstructor = form(saveSchema, async (data, issue) => {
	requireAdmin();

	const baseIndex = data.translations.findIndex((entry) => entry.locale === baseLocale);

	// Only the base locale's name is required. The others may stay empty - the
	// public queries fall back to this one - but nothing can render a card with
	// no name at all.
	if (!data.translations[baseIndex].name) {
		invalid(issue.translations[baseIndex].name(m.admin_required_field()));
	}

	const id = data.id || crypto.randomUUID();
	const photo = data.photo || null;
	const accent = data.accent || null;

	if (data.id) {
		const [existing] = await db
			.select({ id: instructor.id })
			.from(instructor)
			.where(eq(instructor.id, data.id))
			.limit(1);

		if (!existing) error(404, m.error_404_title());

		await db
			.update(instructor)
			.set({ photo, accent, published: data.published })
			.where(eq(instructor.id, data.id));
	} else {
		const [last] = await db.select({ highest: max(instructor.sortOrder) }).from(instructor);

		// New instructors join the end of the grid, where one left on automatic
		// takes the next accent in the cycle.
		await db.insert(instructor).values({
			id,
			sortOrder: (last?.highest ?? -1) + 1,
			photo,
			accent,
			published: data.published
		});
	}

	const submitted = new Map(data.translations.map((entry) => [entry.locale, entry]));
	const blank = { name: '', badge: '', experience: '', bio: '' };

	// One row per known locale, upserted rather than updated, so a locale added
	// after this instructor was created gets its row on the next save.
	for (const locale of contentLocales) {
		const { name, badge, experience, bio } = submitted.get(locale) ?? blank;
		const values = { name, badge, experience, bio };

		await db
			.insert(instructorTranslation)
			.values({ instructorId: id, locale, ...values })
			.onConflictDoUpdate({
				target: [instructorTranslation.instructorId, instructorTranslation.locale],
				set: values
			});
	}

	await listInstructorsForAdmin().refresh();
	// Not just this row: the save may have flipped its `published` flag, which
	// shifts the accent of every instructor below it.
	await refreshInstructorEditorsFrom(id);
	await getAdminOverview().refresh();
	await refreshPublicInstructors();

	redirect(303, localizeHref('/admin/instructors', { locale: data.locale }));
});

export const deleteInstructor = command(idArg, async (id) => {
	requireAdmin();

	// The translations are removed explicitly rather than through the foreign
	// key's cascade, which depends on how the database was configured.
	await db.delete(instructorTranslation).where(eq(instructorTranslation.instructorId, id));
	await db.delete(instructor).where(eq(instructor.id, id));

	await listInstructorsForAdmin().refresh();
	// Removing a row moves every instructor that was below it one step along the
	// accent cycle, exactly as hiding one does.
	await refreshInstructorEditorsFrom(id);
	await getAdminOverview().refresh();
	await refreshPublicInstructors();
});

export const moveInstructor = command(
	v.object({ id: idArg, direction: v.picklist(['up', 'down']) }),
	async ({ id, direction }) => {
		requireAdmin();

		const rows = await db
			.select({ id: instructor.id, sortOrder: instructor.sortOrder })
			.from(instructor)
			.orderBy(asc(instructor.sortOrder), asc(instructor.createdAt));

		const index = rows.findIndex((row) => row.id === id);
		const target = direction === 'up' ? index - 1 : index + 1;

		if (index === -1 || target < 0 || target >= rows.length) return;

		const reordered = [...rows];
		reordered[index] = rows[target];
		reordered[target] = rows[index];

		// Positions are rewritten from the new order instead of swapping the two
		// stored values, because rows that were never reordered can share a
		// `sortOrder` - and swapping two equal numbers moves nothing. Only the
		// rows whose position actually changed are written.
		for (const [position, row] of reordered.entries()) {
			if (row.sortOrder === position) continue;
			await db.update(instructor).set({ sortOrder: position }).where(eq(instructor.id, row.id));
		}

		await listInstructorsForAdmin().refresh();
		// Swapping two neighbours moves those two rows and nobody else: every
		// other instructor still has the same rows ahead of it, so the same accent.
		await refreshInstructorEditors([rows[index].id, rows[target].id]);
		await refreshPublicInstructors();
	}
);

export const setInstructorPublished = command(
	v.object({ id: idArg, published: v.boolean() }),
	async ({ id, published }) => {
		requireAdmin();

		await db.update(instructor).set({ published }).where(eq(instructor.id, id));

		await listInstructorsForAdmin().refresh();
		await refreshInstructorEditorsFrom(id);
		await getAdminOverview().refresh();
		await refreshPublicInstructors();
	}
);
