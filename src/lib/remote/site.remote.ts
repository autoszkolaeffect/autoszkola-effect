import { isIP } from 'node:net';

import { invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import {
	blogCategory,
	blogCategoryTranslation,
	blogPost,
	blogPostTranslation,
	contactMessage,
	contactPhone,
	contactPhoneTranslation,
	contactSettings,
	contactSettingsTranslation,
	courseOption,
	courseOptionTranslation,
	instructor,
	instructorTranslation,
	opinion,
	opinionTranslation
} from '#lib/server/db/schema';
import { baseLocale } from '#lib/locales';
import { renderMarkdown } from '#lib/markdown';
import { escapeHtml, sendNotification } from '#lib/server/mailer';
import { verifyTurnstile } from '#lib/server/turnstile';
import { localeArg } from './schema';
import * as m from '#lib/paraglide/messages';

// Everything here is public, read-only content plus the one write the public site
// can make: a contact form submission.
//
// Each query takes an explicit `locale`. Remote function calls arrive at
// `/_app/remote/...`, which is deliberately excluded from Paraglide's URL
// strategy, so the ambient locale there is always the base locale. Passing it
// keeps the queries correct once a second locale exists, and gives each locale
// its own client-side query cache entry.
//
// Translations fall back to the base locale via a second join, so content
// written before a locale was added still renders.

/** `COALESCE(NULLIF(requested, ''), NULLIF(fallback, ''), '')` */
const withFallback = (requested: unknown, fallback: unknown) =>
	sql<string>`coalesce(nullif(${requested}, ''), nullif(${fallback}, ''), '')`;

/* -------------------------------------------------------------- contact + chrome */

export type SiteContact = Awaited<ReturnType<typeof getSiteContact>>;

/**
 * Everything the "Kontakt" page, the navigation bar's phone button and the
 * footer need. One query, because all three are rendered on every page.
 */
export const getSiteContact = query(localeArg, async (locale) => {
	const requested = alias(contactSettingsTranslation, 'requested');
	const fallback = alias(contactSettingsTranslation, 'fallback');

	const [settings] = await db
		.select({
			email: contactSettings.email,
			mapQuery: contactSettings.mapQuery,
			mapEmbedUrl: contactSettings.mapEmbedUrl,
			pageTitle: withFallback(requested.pageTitle, fallback.pageTitle),
			pageIntro: withFallback(requested.pageIntro, fallback.pageIntro),
			phonesHeading: withFallback(requested.phonesHeading, fallback.phonesHeading),
			addressHeading: withFallback(requested.addressHeading, fallback.addressHeading),
			formHeading: withFallback(requested.formHeading, fallback.formHeading),
			companyName: withFallback(requested.companyName, fallback.companyName),
			addressLine1: withFallback(requested.addressLine1, fallback.addressLine1),
			addressLine2: withFallback(requested.addressLine2, fallback.addressLine2),
			openingHours: withFallback(requested.openingHours, fallback.openingHours),
			footerAddress: withFallback(requested.footerAddress, fallback.footerAddress)
		})
		.from(contactSettings)
		.leftJoin(requested, eq(requested.locale, locale))
		.leftJoin(fallback, eq(fallback.locale, baseLocale))
		.limit(1);

	const phoneRequested = alias(contactPhoneTranslation, 'phone_requested');
	const phoneFallback = alias(contactPhoneTranslation, 'phone_fallback');

	const phones = await db
		.select({
			id: contactPhone.id,
			number: contactPhone.number,
			primary: contactPhone.primary,
			label: withFallback(phoneRequested.label, phoneFallback.label)
		})
		.from(contactPhone)
		.leftJoin(
			phoneRequested,
			and(eq(phoneRequested.phoneId, contactPhone.id), eq(phoneRequested.locale, locale))
		)
		.leftJoin(
			phoneFallback,
			and(eq(phoneFallback.phoneId, contactPhone.id), eq(phoneFallback.locale, baseLocale))
		)
		.orderBy(asc(contactPhone.sortOrder));

	const courseRequested = alias(courseOptionTranslation, 'course_requested');
	const courseFallback = alias(courseOptionTranslation, 'course_fallback');

	const courses = await db
		.select({
			value: courseOption.value,
			label: withFallback(courseRequested.label, courseFallback.label)
		})
		.from(courseOption)
		.leftJoin(
			courseRequested,
			and(eq(courseRequested.courseOptionId, courseOption.id), eq(courseRequested.locale, locale))
		)
		.leftJoin(
			courseFallback,
			and(eq(courseFallback.courseOptionId, courseOption.id), eq(courseFallback.locale, baseLocale))
		)
		.orderBy(asc(courseOption.sortOrder));

	return {
		email: settings?.email ?? '',
		pageTitle: settings?.pageTitle ?? '',
		pageIntro: settings?.pageIntro ?? '',
		phonesHeading: settings?.phonesHeading ?? '',
		addressHeading: settings?.addressHeading ?? '',
		formHeading: settings?.formHeading ?? '',
		companyName: settings?.companyName ?? '',
		addressLine1: settings?.addressLine1 ?? '',
		addressLine2: settings?.addressLine2 ?? '',
		openingHours: settings?.openingHours ?? '',
		footerAddress: settings?.footerAddress ?? '',
		mapUrl: mapEmbedUrl(settings?.mapEmbedUrl, settings?.mapQuery),
		mapLink: mapLink(settings?.mapQuery),
		phones,
		primaryPhone: phones.find((phone) => phone.primary) ?? phones[0],
		courses: courses.filter((course) => course.label)
	};
});

/**
 * Google's keyless embed. `output=embed` renders a map for any query - an
 * address, a place name or "lat,lng" - without an API key or a billing account,
 * which keeps the map editable from the admin panel as plain text.
 */
function mapEmbedUrl(explicit: string | null | undefined, query: string | undefined): string {
	// The explicit URL is admin-supplied and goes straight into an iframe `src`,
	// so the scheme is checked rather than trusted: `javascript:` there runs in
	// this page's context in some browsers, which would turn a panel account
	// into script execution on the public site.
	if (explicit?.trim()) {
		const candidate = explicit.trim();

		try {
			if (new URL(candidate).protocol === 'https:') return candidate;
		} catch {
			// Not a URL at all - fall through to the query-built map below.
		}
	}

	if (!query?.trim()) return '';

	return `https://www.google.com/maps?q=${encodeURIComponent(query.trim())}&hl=pl&z=16&output=embed`;
}

function mapLink(query: string | undefined): string {
	if (!query?.trim()) return '';
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

/* ------------------------------------------------------------------- instructors */

export type PublicInstructor = Awaited<ReturnType<typeof listInstructors>>[number];

export const listInstructors = query(localeArg, async (locale) => {
	const requested = alias(instructorTranslation, 'requested');
	const fallback = alias(instructorTranslation, 'fallback');

	return db
		.select({
			id: instructor.id,
			photo: instructor.photo,
			accent: instructor.accent,
			name: withFallback(requested.name, fallback.name),
			badge: withFallback(requested.badge, fallback.badge),
			experience: withFallback(requested.experience, fallback.experience),
			bio: withFallback(requested.bio, fallback.bio)
		})
		.from(instructor)
		.leftJoin(
			requested,
			and(eq(requested.instructorId, instructor.id), eq(requested.locale, locale))
		)
		.leftJoin(
			fallback,
			and(eq(fallback.instructorId, instructor.id), eq(fallback.locale, baseLocale))
		)
		.where(eq(instructor.published, true))
		.orderBy(asc(instructor.sortOrder), asc(instructor.createdAt));
});

/* ---------------------------------------------------------------------- opinions */

export type PublicOpinion = Awaited<ReturnType<typeof listOpinions>>[number];

export const listOpinions = query(localeArg, async (locale) => {
	const requested = alias(opinionTranslation, 'requested');
	const fallback = alias(opinionTranslation, 'fallback');

	return db
		.select({
			id: opinion.id,
			rating: opinion.rating,
			author: withFallback(requested.author, fallback.author),
			quote: withFallback(requested.quote, fallback.quote)
		})
		.from(opinion)
		.leftJoin(requested, and(eq(requested.opinionId, opinion.id), eq(requested.locale, locale)))
		.leftJoin(fallback, and(eq(fallback.opinionId, opinion.id), eq(fallback.locale, baseLocale)))
		.where(eq(opinion.published, true))
		.orderBy(asc(opinion.sortOrder), asc(opinion.createdAt));
});

/* -------------------------------------------------------------------------- blog */

export type PublicBlogCategory = Awaited<ReturnType<typeof listBlogCategories>>[number];

export const listBlogCategories = query(localeArg, async (locale) => {
	const requested = alias(blogCategoryTranslation, 'requested');
	const fallback = alias(blogCategoryTranslation, 'fallback');

	return db
		.select({
			id: blogCategory.id,
			slug: blogCategory.slug,
			accent: blogCategory.accent,
			label: withFallback(requested.label, fallback.label)
		})
		.from(blogCategory)
		.leftJoin(
			requested,
			and(eq(requested.categoryId, blogCategory.id), eq(requested.locale, locale))
		)
		.leftJoin(
			fallback,
			and(eq(fallback.categoryId, blogCategory.id), eq(fallback.locale, baseLocale))
		)
		.orderBy(asc(blogCategory.sortOrder));
});

export type PublicBlogPost = Awaited<ReturnType<typeof listBlogPosts>>[number];

export const listBlogPosts = query(localeArg, async (locale) => {
	const requested = alias(blogPostTranslation, 'requested');
	const fallback = alias(blogPostTranslation, 'fallback');
	const categoryRequested = alias(blogCategoryTranslation, 'category_requested');
	const categoryFallback = alias(blogCategoryTranslation, 'category_fallback');

	const rows = await db
		.select({
			id: blogPost.id,
			publishedAt: blogPost.publishedAt,
			readingMinutes: blogPost.readingMinutes,
			categorySlug: blogCategory.slug,
			categoryAccent: blogCategory.accent,
			categoryLabel: withFallback(categoryRequested.label, categoryFallback.label),
			slug: sql<string>`coalesce(nullif(${requested.slug}, ''), nullif(${fallback.slug}, ''), '')`,
			title: withFallback(requested.title, fallback.title),
			excerpt: withFallback(requested.excerpt, fallback.excerpt)
		})
		.from(blogPost)
		.leftJoin(requested, and(eq(requested.postId, blogPost.id), eq(requested.locale, locale)))
		.leftJoin(fallback, and(eq(fallback.postId, blogPost.id), eq(fallback.locale, baseLocale)))
		.leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
		.leftJoin(
			categoryRequested,
			and(eq(categoryRequested.categoryId, blogCategory.id), eq(categoryRequested.locale, locale))
		)
		.leftJoin(
			categoryFallback,
			and(eq(categoryFallback.categoryId, blogCategory.id), eq(categoryFallback.locale, baseLocale))
		)
		.where(and(eq(blogPost.status, 'published'), isNotNull(blogPost.publishedAt)))
		.orderBy(desc(blogPost.publishedAt));

	// A post whose translation has no slug yet cannot be linked to, so it stays
	// off the list rather than rendering a dead card.
	return rows.filter((row) => row.slug && row.title);
});

export type PublicBlogArticle = NonNullable<Awaited<ReturnType<typeof getBlogPost>>>;

export const getBlogPost = query(
	v.object({ locale: localeArg, slug: v.pipe(v.string(), v.maxLength(120)) }),
	async ({ locale, slug }) => {
		const requested = alias(blogPostTranslation, 'requested');
		const fallback = alias(blogPostTranslation, 'fallback');
		const categoryRequested = alias(blogCategoryTranslation, 'category_requested');
		const categoryFallback = alias(blogCategoryTranslation, 'category_fallback');

		const [row] = await db
			.select({
				id: blogPost.id,
				publishedAt: blogPost.publishedAt,
				readingMinutes: blogPost.readingMinutes,
				categorySlug: blogCategory.slug,
				categoryAccent: blogCategory.accent,
				categoryLabel: withFallback(categoryRequested.label, categoryFallback.label),
				title: withFallback(requested.title, fallback.title),
				excerpt: withFallback(requested.excerpt, fallback.excerpt),
				body: withFallback(requested.body, fallback.body)
			})
			.from(blogPost)
			.leftJoin(requested, and(eq(requested.postId, blogPost.id), eq(requested.locale, locale)))
			.leftJoin(fallback, and(eq(fallback.postId, blogPost.id), eq(fallback.locale, baseLocale)))
			.leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
			.leftJoin(
				categoryRequested,
				and(eq(categoryRequested.categoryId, blogCategory.id), eq(categoryRequested.locale, locale))
			)
			.leftJoin(
				categoryFallback,
				and(
					eq(categoryFallback.categoryId, blogCategory.id),
					eq(categoryFallback.locale, baseLocale)
				)
			)
			.where(
				and(
					eq(blogPost.status, 'published'),
					isNotNull(blogPost.publishedAt),
					// The same coalesce `listBlogPosts` builds its hrefs from. Matching
					// the requested locale alone would 404 every link on the list for a
					// locale that has no translation yet, because those cards carry the
					// base locale's slug.
					eq(sql`coalesce(nullif(${requested.slug}, ''), nullif(${fallback.slug}, ''), '')`, slug)
				)
			)
			.limit(1);

		if (!row) return null;

		// Rendered here rather than in the component so the article is in the SSR
		// payload, and so markdown-it never ships to the browser.
		return { ...row, html: renderMarkdown(row.body) };
	}
);

/* ------------------------------------------------------------------ contact form */

// The messages are passed as thunks, not strings: this schema is built once when
// the module loads, outside any request, so calling a message function here would
// bake in whichever locale happened to be ambient at import time.
const contactFormSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, () => m.contact_form_error_name_short()),
		v.maxLength(120)
	),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.email(() => m.contact_form_error_email()),
		v.maxLength(180)
	),
	phone: v.pipe(v.string(), v.trim(), v.maxLength(40)),
	// Optional because the page hides the whole control when the admin has not
	// defined any course options. A required field with no rendered input would
	// fail validation against an error message the visitor cannot see or fix.
	course: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120)), ''),
	message: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, () => m.contact_form_error_message_short()),
		v.maxLength(5000)
	),
	locale: localeArg,
	// Turnstile's own hidden input is called `cf-turnstile-response`, but a remote
	// form names its fields in JS object notation and rejects anything that would
	// need quoting. The widget is rendered with `response-field: false` and writes
	// the token into an input named after this field instead.
	turnstileToken: v.pipe(v.string(), v.maxLength(4096))
});

export const submitContactForm = form(contactFormSchema, async (data, issue) => {
	const event = getRequestEvent();
	const ip = clientIp(event);

	const captcha = await verifyTurnstile(data.turnstileToken, ip);

	if (!captcha.ok) {
		// `issue.x()` only builds an issue - it has to be handed to `invalid()` to
		// actually fail the submission. Returning normally here would look like a
		// success to the client, reset the form, and lose what the visitor wrote.
		invalid(issue.turnstileToken(m.contact_form_error_captcha()));
	}

	const [stored] = await db
		.insert(contactMessage)
		.values({
			name: data.name,
			email: data.email,
			phone: data.phone || null,
			course: data.course || null,
			message: data.message,
			locale: data.locale,
			ipAddress: ip,
			userAgent: event.request.headers.get('user-agent')?.slice(0, 500) ?? null
		})
		.returning({ id: contactMessage.id });

	// The visitor's message is already safe in the database, so a mail failure is
	// recorded against the row and surfaced in the admin panel rather than shown
	// to them as a submission failure.
	const result = await sendNotification({
		subject: m.mail_contact_subject({ name: data.name }),
		replyTo: data.email,
		text: notificationText(data),
		html: notificationHtml(data)
	});

	if (stored?.id) {
		await db
			.update(contactMessage)
			.set({
				notificationStatus: result.status,
				notificationError: result.status === 'failed' ? result.error.slice(0, 500) : null,
				notificationSentAt: result.status === 'sent' ? new Date() : null
			})
			.where(eq(contactMessage.id, stored.id));
	}

	return { ok: true as const };
});

// The longest textual IPv6 address, `::ffff:255.255.255.255` style tail included.
const MAX_IP_LENGTH = 45;

/**
 * The address is only used to strengthen the Turnstile check and to give the
 * operator context, so losing it must not lose the message.
 *
 * The platform's own address is preferred. `cf-connecting-ip` is a plain request
 * header - this deploys to Vercel, not behind Cloudflare, so nothing sets it but
 * the caller - hence it is only consulted as a fallback, bounded before parsing
 * and stored only when it really is an address.
 */
function clientIp(event: ReturnType<typeof getRequestEvent>): string | null {
	return tryClientAddress(event) ?? headerIp(event.request);
}

function tryClientAddress(event: ReturnType<typeof getRequestEvent>): string | null {
	try {
		// Throws on adapters that cannot determine an address.
		return event.getClientAddress();
	} catch {
		return null;
	}
}

function headerIp(request: Request): string | null {
	const value = request.headers.get('cf-connecting-ip')?.trim() ?? '';

	if (!value || value.length > MAX_IP_LENGTH || isIP(value) === 0) return null;

	return value;
}

type ContactData = v.InferOutput<typeof contactFormSchema>;

function notificationText(data: ContactData): string {
	return [
		m.mail_contact_heading(),
		'',
		`${m.mail_contact_name()}: ${data.name}`,
		`${m.mail_contact_email()}: ${data.email}`,
		data.phone ? `${m.mail_contact_phone()}: ${data.phone}` : null,
		data.course ? `${m.mail_contact_course()}: ${data.course}` : null,
		'',
		`${m.mail_contact_message()}:`,
		data.message,
		'',
		m.mail_contact_footer()
	]
		.filter((line) => line !== null)
		.join('\n');
}

function notificationHtml(data: ContactData): string {
	const row = (label: string, value: string) =>
		`<tr><th align="left" style="padding:4px 16px 4px 0;color:#5b6673;font-weight:normal;white-space:nowrap">${escapeHtml(label)}</th><td style="padding:4px 0;color:#001633">${escapeHtml(value)}</td></tr>`;

	return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#001633">
	<h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(m.mail_contact_heading())}</h2>
	<table style="border-collapse:collapse;margin-bottom:16px">
		${row(m.mail_contact_name(), data.name)}
		${row(m.mail_contact_email(), data.email)}
		${data.phone ? row(m.mail_contact_phone(), data.phone) : ''}
		${data.course ? row(m.mail_contact_course(), data.course) : ''}
	</table>
	<div style="border-left:3px solid #d62828;padding-left:16px;white-space:pre-wrap">${escapeHtml(data.message)}</div>
	<p style="margin-top:24px;font-size:12px;color:#5b6673">${escapeHtml(m.mail_contact_footer())}</p>
</div>`;
}
