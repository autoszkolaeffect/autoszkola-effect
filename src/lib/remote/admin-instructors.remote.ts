import { command, form, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { asc, eq, inArray, max, sql } from 'drizzle-orm';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import { instructor, instructorTranslation } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
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
 * Every mutation here changes what that grid shows - the order and the
 * published flag included, since both decide which cards appear and in which
 * accent colour.
 */
async function refreshPublicInstructors(): Promise<void> {
	await Promise.all(contentLocales.map((locale) => listInstructors(locale).refresh()));
}

/* ------------------------------------------------------------------- reading */

export type AdminInstructorListItem = Awaited<ReturnType<typeof listInstructorsForAdmin>>[number];

export const listInstructorsForAdmin = query(async () => {
	requireAdmin();

	const rows = await db
		.select({
			id: instructor.id,
			published: instructor.published,
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
			published: instructor.published
		})
		.from(instructor)
		.where(eq(instructor.id, id))
		.limit(1);

	if (!row) return null;

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

// The messages are thunks: this schema is built once when the module loads,
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

const saveSchema = v.object({
	// Empty when the form is creating rather than editing.
	id: v.pipe(v.string(), v.maxLength(64)),
	// Which locale of the panel the editor is working in, so the redirect after
	// saving lands on the localized list rather than the base locale's.
	locale: localeArg,
	published: v.optional(v.boolean(), false),
	photo: photoArg,
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

	if (data.id) {
		const [existing] = await db
			.select({ id: instructor.id })
			.from(instructor)
			.where(eq(instructor.id, data.id))
			.limit(1);

		if (!existing) error(404, m.error_404_title());

		await db
			.update(instructor)
			.set({ photo, published: data.published })
			.where(eq(instructor.id, data.id));
	} else {
		const [last] = await db.select({ highest: max(instructor.sortOrder) }).from(instructor);

		// New instructors join the end of the grid, where they take the next
		// accent in the cycle.
		await db.insert(instructor).values({
			id,
			sortOrder: (last?.highest ?? -1) + 1,
			photo,
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
	await getInstructorForAdmin(id).refresh();
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
		await refreshPublicInstructors();
	}
);

export const setInstructorPublished = command(
	v.object({ id: idArg, published: v.boolean() }),
	async ({ id, published }) => {
		requireAdmin();

		await db.update(instructor).set({ published }).where(eq(instructor.id, id));

		await listInstructorsForAdmin().refresh();
		await getAdminOverview().refresh();
		await refreshPublicInstructors();
	}
);
