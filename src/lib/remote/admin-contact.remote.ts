import { command, form, query } from '$app/server';
import { asc, eq, ne, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { error, invalid } from '@sveltejs/kit';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import {
	contactPhone,
	contactPhoneTranslation,
	contactSettings,
	contactSettingsTranslation,
	courseOption,
	courseOptionTranslation
} from '#lib/server/db/schema';
import { byLocale, contentLocales, type Locale } from '#lib/locales';
import { requireAdmin } from '#lib/server/guard';
import { idArg, optionalText, perLocale } from './schema';
import { getSiteContact } from './site.remote';
import * as m from '#lib/paraglide/messages';

// Everything behind the "Kontakt" tab of the admin panel: the singleton settings
// row, the phone list and the contact form's course options. The public side of
// the same data is `getSiteContact` in site.remote.ts.

/** `contact_settings` holds one row, and this is its id. */
const SINGLETON = 'singleton';

/**
 * `trimmed()` from ./schema takes its message as a string, which would be
 * resolved when this module is first imported - outside any request, in whatever
 * locale happened to be ambient. Passing a thunk defers it to the call.
 */
const required = (max: number) =>
	v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, () => m.admin_required_field()),
		v.maxLength(max)
	);

const emailShape = v.pipe(v.string(), v.email());

const optionalEmail = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(180),
	v.check(
		(value) => value === '' || v.is(emailShape, value),
		() => m.contact_form_error_email()
	)
);

const optionalEmbedUrl = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(1000),
	v.check(
		(value) => value === '' || value.startsWith('https://'),
		() => m.admin_contact_map_embed_invalid()
	)
);

/* ----------------------------------------------------------------------- read */

type SettingsText = {
	locale: string;
	pageTitle: string;
	pageIntro: string;
	phonesHeading: string;
	addressHeading: string;
	formHeading: string;
	companyName: string;
	addressLine1: string;
	addressLine2: string;
	openingHours: string;
	footerAddress: string;
};

const emptySettingsText = (locale: Locale): SettingsText => ({
	locale,
	pageTitle: '',
	pageIntro: '',
	phonesHeading: '',
	addressHeading: '',
	formHeading: '',
	companyName: '',
	addressLine1: '',
	addressLine2: '',
	openingHours: '',
	footerAddress: ''
});

/**
 * The per-locale maps are keyed by a plain string, not by `Locale`, so the
 * editor can index them with the locale its tabs hand back.
 */
function textByLocale(rows: SettingsText[]): Record<string, SettingsText> {
	return byLocale(rows, emptySettingsText);
}

function labelsByLocale(rows: { locale: string; label: string }[]): Record<string, string> {
	const found = byLocale(rows, (locale) => ({ locale, label: '' }));
	return Object.fromEntries(contentLocales.map((locale) => [locale, found[locale].label]));
}

/**
 * This screen's own view plus the public contact page, which a client-side
 * navigation out of the panel would otherwise render from the cache the
 * visitor's session filled before the edit. Everything here - the text, the
 * phones, the course options - is on that one page.
 */
async function refreshContact(): Promise<void> {
	await Promise.all([
		getContactForAdmin().refresh(),
		...contentLocales.map((locale) => getSiteContact(locale).refresh())
	]);
}

export type AdminContact = Awaited<ReturnType<typeof getContactForAdmin>>;

export const getContactForAdmin = query(async () => {
	requireAdmin();

	const [settings] = await db
		.select({
			email: contactSettings.email,
			mapQuery: contactSettings.mapQuery,
			mapEmbedUrl: contactSettings.mapEmbedUrl
		})
		.from(contactSettings)
		.where(eq(contactSettings.id, SINGLETON))
		.limit(1);

	const translations = await db
		.select({
			locale: contactSettingsTranslation.locale,
			pageTitle: contactSettingsTranslation.pageTitle,
			pageIntro: contactSettingsTranslation.pageIntro,
			phonesHeading: contactSettingsTranslation.phonesHeading,
			addressHeading: contactSettingsTranslation.addressHeading,
			formHeading: contactSettingsTranslation.formHeading,
			companyName: contactSettingsTranslation.companyName,
			addressLine1: contactSettingsTranslation.addressLine1,
			addressLine2: contactSettingsTranslation.addressLine2,
			openingHours: contactSettingsTranslation.openingHours,
			footerAddress: contactSettingsTranslation.footerAddress
		})
		.from(contactSettingsTranslation);

	const phones = await db
		.select({ id: contactPhone.id, number: contactPhone.number, primary: contactPhone.primary })
		.from(contactPhone)
		.orderBy(asc(contactPhone.sortOrder));

	const phoneLabels = await db
		.select({
			phoneId: contactPhoneTranslation.phoneId,
			locale: contactPhoneTranslation.locale,
			label: contactPhoneTranslation.label
		})
		.from(contactPhoneTranslation);

	const courses = await db
		.select({ id: courseOption.id, value: courseOption.value })
		.from(courseOption)
		.orderBy(asc(courseOption.sortOrder));

	const courseLabels = await db
		.select({
			courseOptionId: courseOptionTranslation.courseOptionId,
			locale: courseOptionTranslation.locale,
			label: courseOptionTranslation.label
		})
		.from(courseOptionTranslation);

	return {
		email: settings?.email ?? '',
		mapQuery: settings?.mapQuery ?? '',
		mapEmbedUrl: settings?.mapEmbedUrl ?? '',
		text: textByLocale(translations),
		phones: phones.map((phone) => ({
			...phone,
			labels: labelsByLocale(phoneLabels.filter((row) => row.phoneId === phone.id))
		})),
		courses: courses.map((course) => ({
			...course,
			labels: labelsByLocale(courseLabels.filter((row) => row.courseOptionId === course.id))
		}))
	};
});

/* ------------------------------------------------------------------- settings */

const settingsTextSchema = v.object({
	pageTitle: optionalText(160),
	pageIntro: optionalText(600),
	phonesHeading: optionalText(120),
	addressHeading: optionalText(120),
	formHeading: optionalText(120),
	companyName: optionalText(160),
	addressLine1: optionalText(200),
	addressLine2: optionalText(200),
	openingHours: optionalText(200),
	footerAddress: optionalText(200)
});

export const saveContactSettings = form(
	v.object({
		email: optionalEmail,
		mapQuery: optionalText(300),
		mapEmbedUrl: optionalEmbedUrl,
		text: perLocale(settingsTextSchema)
	}),
	async (data) => {
		requireAdmin();

		const settings = {
			email: data.email,
			mapQuery: data.mapQuery,
			// Nullable in the schema so "no override" is one value, not two.
			mapEmbedUrl: data.mapEmbedUrl || null,
			updatedAt: new Date()
		};

		// The row is created on first save rather than assumed to exist, so a
		// database that has never been seeded still works.
		await db
			.insert(contactSettings)
			.values({ id: SINGLETON, ...settings })
			.onConflictDoUpdate({ target: contactSettings.id, set: settings });

		for (const [index, locale] of contentLocales.entries()) {
			const text = data.text[index];
			if (!text) continue;

			await db
				.insert(contactSettingsTranslation)
				.values({ locale, ...text })
				.onConflictDoUpdate({ target: contactSettingsTranslation.locale, set: text });
		}

		await refreshContact();

		return { saved: true };
	}
);

/* --------------------------------------------------------------------- phones */

/** `max(sort_order) + 1`, so a new row lands at the end of the list. */
async function nextSortOrder(table: SQLiteTable, column: SQLiteColumn) {
	const [row] = await db
		.select({ next: sql<number>`coalesce(max(${column}), -1) + 1` })
		.from(table);

	return Number(row?.next ?? 0);
}

/**
 * Settles the "exactly one primary" rule the navigation bar depends on: it shows
 * a single number, so as long as there is a phone at all, one row and only one
 * carries the flag.
 *
 * The editor cannot enforce it - each row posts its own form, so a submission
 * can only ever demote the row it belongs to, and a delete can take the only row
 * that had the flag with it. `preferred` is the row the submission asked to
 * promote; failing that the flag stays where it already is, and failing that it
 * goes to the first phone by sort order.
 */
async function settlePrimaryPhone(preferred?: string): Promise<void> {
	const rows = await db
		.select({ id: contactPhone.id, primary: contactPhone.primary })
		.from(contactPhone)
		.orderBy(asc(contactPhone.sortOrder));

	const winner =
		rows.find((row) => row.id === preferred) ?? rows.find((row) => row.primary) ?? rows[0];

	// Nothing to write when the flag already sits where it belongs, which is the
	// common case and would otherwise cost two D1 round trips on every save.
	if (!winner || rows.every((row) => row.primary === (row.id === winner.id))) return;

	await db.update(contactPhone).set({ primary: true }).where(eq(contactPhone.id, winner.id));
	await db.update(contactPhone).set({ primary: false }).where(ne(contactPhone.id, winner.id));
}

export const savePhone = form(
	v.object({
		id: v.optional(idArg),
		number: required(40),
		primary: v.optional(v.boolean(), false),
		labels: perLocale(optionalText(80))
	}),
	async (data) => {
		requireAdmin();

		let id = data.id;

		if (id) {
			// `returning` doubles as an existence check: without it a row deleted in
			// another tab would silently gain orphaned translations below.
			const [row] = await db
				.update(contactPhone)
				.set({ number: data.number, primary: data.primary })
				.where(eq(contactPhone.id, id))
				.returning({ id: contactPhone.id });

			if (!row) error(404, m.admin_error_generic());
		} else {
			const [row] = await db
				.insert(contactPhone)
				.values({
					number: data.number,
					primary: data.primary,
					sortOrder: await nextSortOrder(contactPhone, contactPhone.sortOrder)
				})
				.returning({ id: contactPhone.id });

			if (!row) error(500, m.admin_error_generic());
			id = row.id;
		}

		await settlePrimaryPhone(data.primary ? id : undefined);

		for (const [index, locale] of contentLocales.entries()) {
			const label = data.labels[index];
			if (label === undefined) continue;

			await db
				.insert(contactPhoneTranslation)
				.values({ phoneId: id, locale, label })
				.onConflictDoUpdate({
					target: [contactPhoneTranslation.phoneId, contactPhoneTranslation.locale],
					set: { label }
				});
		}

		await refreshContact();

		return { saved: true };
	}
);

export const deletePhone = command(idArg, async (id) => {
	requireAdmin();

	// The cascade would take care of the translations, but D1 only enforces
	// foreign keys when the connection asks it to, so they go first.
	await db.delete(contactPhoneTranslation).where(eq(contactPhoneTranslation.phoneId, id));
	await db.delete(contactPhone).where(eq(contactPhone.id, id));

	// Deleting the primary would otherwise leave the navigation bar with no number.
	await settlePrimaryPhone();

	await refreshContact();
});

const moveArgs = v.object({ id: idArg, direction: v.picklist(['up', 'down']) });

/**
 * The list of ids after `id` has swapped places with its neighbour, or `null`
 * when it is already at that end.
 */
function reordered(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
	const index = ids.indexOf(id);
	const target = direction === 'up' ? index - 1 : index + 1;

	if (index === -1 || target < 0 || target >= ids.length) return null;

	const next = [...ids];
	next[index] = ids[target];
	next[target] = id;

	return next;
}

export const movePhone = command(moveArgs, async ({ id, direction }) => {
	requireAdmin();

	const rows = await db
		.select({ id: contactPhone.id })
		.from(contactPhone)
		.orderBy(asc(contactPhone.sortOrder));

	const next = reordered(
		rows.map((row) => row.id),
		id,
		direction
	);
	if (!next) return;

	// The whole list is renumbered rather than two rows swapped, because seeded
	// rows can share a sort order and would otherwise never separate.
	for (const [index, rowId] of next.entries()) {
		await db.update(contactPhone).set({ sortOrder: index }).where(eq(contactPhone.id, rowId));
	}

	await refreshContact();
});

/* ------------------------------------------------------------- course options */

export const saveCourseOption = form(
	v.object({
		id: v.optional(idArg),
		value: required(120),
		labels: perLocale(optionalText(120))
	}),
	async (data, issue) => {
		requireAdmin();

		const [clash] = await db
			.select({ id: courseOption.id })
			.from(courseOption)
			.where(eq(courseOption.value, data.value))
			.limit(1);

		// `value` is what gets stored on every message sent through the form, so it
		// has to stay unique - the database says so too, but a thrown constraint
		// error would land on the page as a 500 rather than next to the field.
		if (clash && clash.id !== data.id) {
			invalid(issue.value(m.admin_contact_course_value_taken()));
		}

		let id = data.id;

		if (id) {
			const [row] = await db
				.update(courseOption)
				.set({ value: data.value })
				.where(eq(courseOption.id, id))
				.returning({ id: courseOption.id });

			if (!row) error(404, m.admin_error_generic());
		} else {
			const [row] = await db
				.insert(courseOption)
				.values({
					value: data.value,
					sortOrder: await nextSortOrder(courseOption, courseOption.sortOrder)
				})
				.returning({ id: courseOption.id });

			if (!row) error(500, m.admin_error_generic());
			id = row.id;
		}

		for (const [index, locale] of contentLocales.entries()) {
			const label = data.labels[index];
			if (label === undefined) continue;

			await db
				.insert(courseOptionTranslation)
				.values({ courseOptionId: id, locale, label })
				.onConflictDoUpdate({
					target: [courseOptionTranslation.courseOptionId, courseOptionTranslation.locale],
					set: { label }
				});
		}

		await refreshContact();

		return { saved: true };
	}
);

export const deleteCourseOption = command(idArg, async (id) => {
	requireAdmin();

	await db.delete(courseOptionTranslation).where(eq(courseOptionTranslation.courseOptionId, id));
	await db.delete(courseOption).where(eq(courseOption.id, id));

	await refreshContact();
});

export const moveCourseOption = command(moveArgs, async ({ id, direction }) => {
	requireAdmin();

	const rows = await db
		.select({ id: courseOption.id })
		.from(courseOption)
		.orderBy(asc(courseOption.sortOrder));

	const next = reordered(
		rows.map((row) => row.id),
		id,
		direction
	);
	if (!next) return;

	for (const [index, rowId] of next.entries()) {
		await db.update(courseOption).set({ sortOrder: index }).where(eq(courseOption.id, rowId));
	}

	await refreshContact();
});
