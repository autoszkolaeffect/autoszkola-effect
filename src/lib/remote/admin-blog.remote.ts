import { command, form, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { and, asc, count, desc, eq, ne } from 'drizzle-orm';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import {
	blogCategory,
	blogCategoryTranslation,
	blogPost,
	blogPostTranslation
} from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
import { ACCENTS } from '#lib/accents';
import { slugify } from '#lib/format';
import { baseLocale, contentLocales } from '#lib/locales';
import { localizeHref } from '#lib/paraglide/runtime';
import { getAdminOverview } from './admin-dashboard.remote';
import { getBlogPost, listBlogCategories, listBlogPosts } from './site.remote';
import { idArg, localeArg, optionalText } from './schema';
import * as m from '#lib/paraglide/messages';

// The blog side of the admin panel. Unlike the public queries in
// site.remote.ts, nothing here resolves a locale in SQL: an editor has to see
// every translation at once, including the ones that are still empty, so the
// rows are handed over as they are and `pickTranslation()` chooses on the
// client.

/**
 * Everywhere a change to the blog shows up on the public site. Without this a
 * client-side navigation from the panel to /pl/blog renders the list the
 * visitor's session cached before the edit - the same reason
 * `refreshOpinions()` exists in admin-opinions.remote.ts.
 *
 * `slugs` are the article URLs this change touched, so the article page is
 * refreshed too; a slug that has just been renamed is passed in its old form
 * as well, because that is the entry a cache would still be holding.
 */
async function refreshPublicBlog(slugs: { locale: string; slug: string }[] = []): Promise<void> {
	await Promise.all([
		...contentLocales.map((locale) => listBlogPosts(locale).refresh()),
		...contentLocales.map((locale) => listBlogCategories(locale).refresh()),
		...slugs.map(({ locale, slug }) => getBlogPost({ locale, slug }).refresh())
	]);
}

/* -------------------------------------------------------------------- posts */

export type AdminBlogPost = Awaited<ReturnType<typeof listPostsForAdmin>>[number];

export const listPostsForAdmin = query(async () => {
	requireAdmin();

	const posts = await db
		.select({
			id: blogPost.id,
			status: blogPost.status,
			publishedAt: blogPost.publishedAt,
			readingMinutes: blogPost.readingMinutes,
			categoryId: blogPost.categoryId,
			accent: blogCategory.accent
		})
		.from(blogPost)
		.leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
		.orderBy(desc(blogPost.publishedAt), desc(blogPost.createdAt));

	// Two flat reads joined in memory rather than a join per locale: the whole
	// blog is a few dozen rows, and D1 is reached over HTTP, so fewer round
	// trips beats a cleverer query.
	const titles = await db
		.select({
			postId: blogPostTranslation.postId,
			locale: blogPostTranslation.locale,
			title: blogPostTranslation.title,
			slug: blogPostTranslation.slug
		})
		.from(blogPostTranslation);

	const labels = await db
		.select({
			categoryId: blogCategoryTranslation.categoryId,
			locale: blogCategoryTranslation.locale,
			label: blogCategoryTranslation.label
		})
		.from(blogCategoryTranslation);

	return posts.map(({ categoryId, accent, ...post }) => ({
		...post,
		translations: titles.filter((row) => row.postId === post.id),
		category: categoryId
			? {
					id: categoryId,
					accent,
					translations: labels.filter((row) => row.categoryId === categoryId)
				}
			: null
	}));
});

export type AdminBlogPostDetail = NonNullable<Awaited<ReturnType<typeof getPostForAdmin>>>;

export const getPostForAdmin = query(idArg, async (id) => {
	requireAdmin();

	const [post] = await db
		.select({
			id: blogPost.id,
			categoryId: blogPost.categoryId,
			status: blogPost.status,
			publishedAt: blogPost.publishedAt,
			readingMinutes: blogPost.readingMinutes
		})
		.from(blogPost)
		.where(eq(blogPost.id, id))
		.limit(1);

	if (!post) return null;

	const translations = await db
		.select({
			locale: blogPostTranslation.locale,
			slug: blogPostTranslation.slug,
			title: blogPostTranslation.title,
			excerpt: blogPostTranslation.excerpt,
			body: blogPostTranslation.body
		})
		.from(blogPostTranslation)
		.where(eq(blogPostTranslation.postId, id));

	return { ...post, translations };
});

const postSchema = v.object({
	// Empty means "create"; the editor route uses a placeholder segment for a
	// post that does not exist yet.
	id: optionalText(64),
	categoryId: optionalText(64),
	status: v.picklist(['draft', 'published']),
	publishedAt: v.pipe(
		v.string(),
		v.trim(),
		v.regex(/^(\d{4}-\d{2}-\d{2})?$/),
		// Midday local time, so that formatting the date back into the picker in
		// any timezone lands on the day the editor chose.
		v.transform((value) => (value ? new Date(`${value}T12:00:00`) : null))
	),
	readingMinutes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(240)), 1),
	translations: v.array(
		v.object({
			locale: localeArg,
			title: optionalText(200),
			slug: optionalText(80),
			excerpt: optionalText(600),
			body: optionalText(40000)
		})
	)
});

// Whether another post already holds this slug in this locale.
//
// D1 is reached over its REST API, so there is no transaction to check and
// write inside, and a broken constraint comes back as an opaque message rather
// than as a code. The question is therefore asked twice: once before writing,
// to report the clash on the field that caused it, and once after a write
// fails, to tell a slug taken in between from a genuine fault.
async function postSlugTaken(postId: string, locale: string, slug: string): Promise<boolean> {
	const [clash] = await db
		.select({ id: blogPostTranslation.id })
		.from(blogPostTranslation)
		.where(
			and(
				eq(blogPostTranslation.locale, locale),
				eq(blogPostTranslation.slug, slug),
				ne(blogPostTranslation.postId, postId)
			)
		)
		.limit(1);

	return Boolean(clash);
}

export const savePost = form(postSchema, async (data, issue) => {
	requireAdmin();

	const seen = new Set<string>();
	const entries = data.translations
		.map((translation, index) => ({
			index,
			locale: translation.locale,
			title: translation.title,
			excerpt: translation.excerpt,
			body: translation.body,
			// A blank slug field means "derive one from the title", and a slug the
			// editor typed by hand is normalised too, so an unreachable URL cannot
			// be saved.
			slug: slugify(translation.slug || translation.title)
		}))
		.filter((entry) => {
			if (seen.has(entry.locale)) return false;
			seen.add(entry.locale);
			return true;
		})
		// Written base locale first, because every other locale falls back to it:
		// if a later one fails, what is left behind is still a readable post.
		.sort((a, b) => Number(b.locale === baseLocale) - Number(a.locale === baseLocale));

	const base = entries.find((entry) => entry.locale === baseLocale);

	if (!base || !base.title) {
		invalid(issue.translations[base?.index ?? 0].title(m.admin_required_field()));
	}

	// `listBlogPosts` drops any post it cannot build a URL for, so publishing
	// without a slug would make the post disappear instead of going live. One is
	// normally derived from the title, but a title with nothing sluggable in it -
	// "!!!", or a script slugify() cannot transliterate - leaves it empty.
	if (data.status === 'published' && !base.slug) {
		invalid(issue.translations[base.index].slug(m.admin_blog_slug_required_to_publish()));
	}

	const postId = data.id || crypto.randomUUID();

	// Held for the refresh at the end: a slug the editor has just renamed is the
	// one a visitor's cache still has an article under.
	let previousSlugs: { locale: string; slug: string }[] = [];

	if (data.id) {
		const [stored] = await db
			.select({ id: blogPost.id })
			.from(blogPost)
			.where(eq(blogPost.id, data.id))
			.limit(1);

		// A post deleted while its editor was open would otherwise update nothing
		// and still get its translations inserted, under an id no post carries.
		// The panel cannot show those rows, but they keep their slugs reserved in
		// the (locale, slug) index for good.
		if (!stored) error(404, m.error_404_title());

		previousSlugs = (
			await db
				.select({ locale: blogPostTranslation.locale, slug: blogPostTranslation.slug })
				.from(blogPostTranslation)
				.where(eq(blogPostTranslation.postId, data.id))
		).flatMap(({ locale, slug }) => (slug ? [{ locale, slug }] : []));
	}

	// The (locale, slug) index would reject a clash with a database error the
	// editor cannot act on, so the clash is looked up first and reported against
	// the field that caused it.
	for (const entry of entries) {
		if (!entry.slug) continue;

		if (await postSlugTaken(postId, entry.locale, entry.slug)) {
			invalid(issue.translations[entry.index].slug(m.admin_blog_slug_taken()));
		}
	}

	const shared = {
		categoryId: data.categoryId || null,
		status: data.status,
		// The public query only shows posts that carry a date, so publishing
		// without one stamps today rather than silently hiding the post.
		publishedAt: data.status === 'published' ? (data.publishedAt ?? new Date()) : data.publishedAt,
		readingMinutes: data.readingMinutes
	};

	if (data.id) {
		await db.update(blogPost).set(shared).where(eq(blogPost.id, postId));
	} else {
		await db.insert(blogPost).values({ id: postId, ...shared });
	}

	const existingLocales = await db
		.select({ locale: blogPostTranslation.locale })
		.from(blogPostTranslation)
		.where(eq(blogPostTranslation.postId, postId));

	for (const entry of entries) {
		const words = {
			title: entry.title,
			excerpt: entry.excerpt,
			body: entry.body,
			// NULL rather than '': SQLite's UNIQUE tolerates many NULLs but only a
			// single '', so two slugless drafts would collide.
			slug: entry.slug || null
		};

		try {
			if (existingLocales.some((row) => row.locale === entry.locale)) {
				await db
					.update(blogPostTranslation)
					.set(words)
					.where(
						and(
							eq(blogPostTranslation.postId, postId),
							eq(blogPostTranslation.locale, entry.locale)
						)
					);
			} else {
				await db.insert(blogPostTranslation).values({ postId, locale: entry.locale, ...words });
			}
		} catch (cause) {
			// The post row is already committed and there is no transaction to undo
			// it with, so a post created moments ago would be left in the list as an
			// untitled row with no translation to edit. It is removed by hand.
			if (!data.id) {
				await db.delete(blogPostTranslation).where(eq(blogPostTranslation.postId, postId));
				await db.delete(blogPost).where(eq(blogPost.id, postId));
			}

			// The likely reason a write fails here is the slug being taken between
			// the lookup above and this line, which is the editor's to fix; anything
			// else is ours.
			if (entry.slug && (await postSlugTaken(postId, entry.locale, entry.slug))) {
				invalid(issue.translations[entry.index].slug(m.admin_blog_slug_taken()));
			}

			throw cause;
		}
	}

	await listPostsForAdmin().refresh();
	await getAdminOverview().refresh();
	await refreshPublicBlog([
		...previousSlugs,
		...entries.flatMap((entry) => (entry.slug ? [{ locale: entry.locale, slug: entry.slug }] : []))
	]);

	if (!data.id) {
		// The editor is addressed by the id in its URL, and the create form sits on
		// the `nowy` placeholder, so it has no way to follow the id minted here. A
		// new post lands back on the list, which is also where its row now is.
		redirect(303, localizeHref('/admin/blog'));
	}

	await getPostForAdmin(postId).refresh();

	return { ok: true as const };
});

export const deletePost = command(idArg, async (id) => {
	requireAdmin();

	// Read before the delete, so the article pages can be invalidated by URL.
	const slugs = (
		await db
			.select({ locale: blogPostTranslation.locale, slug: blogPostTranslation.slug })
			.from(blogPostTranslation)
			.where(eq(blogPostTranslation.postId, id))
	).flatMap(({ locale, slug }) => (slug ? [{ locale, slug }] : []));

	// Explicit rather than relying on ON DELETE CASCADE: foreign key enforcement
	// is a per-connection pragma, and orphaned translations would keep their
	// slugs reserved.
	await db.delete(blogPostTranslation).where(eq(blogPostTranslation.postId, id));
	await db.delete(blogPost).where(eq(blogPost.id, id));

	await listPostsForAdmin().refresh();
	await getAdminOverview().refresh();
	await refreshPublicBlog(slugs);
});

/* --------------------------------------------------------------- categories */

export type AdminBlogCategory = Awaited<ReturnType<typeof listCategoriesForAdmin>>[number];

export const listCategoriesForAdmin = query(async () => {
	requireAdmin();

	const categories = await db
		.select({
			id: blogCategory.id,
			slug: blogCategory.slug,
			accent: blogCategory.accent,
			sortOrder: blogCategory.sortOrder
		})
		.from(blogCategory)
		.orderBy(asc(blogCategory.sortOrder), asc(blogCategory.createdAt));

	const labels = await db
		.select({
			categoryId: blogCategoryTranslation.categoryId,
			locale: blogCategoryTranslation.locale,
			label: blogCategoryTranslation.label
		})
		.from(blogCategoryTranslation);

	// Drives the delete guard below, and tells the editor which categories are
	// safe to remove before they try.
	const usage = await db
		.select({ categoryId: blogPost.categoryId, posts: count() })
		.from(blogPost)
		.groupBy(blogPost.categoryId);

	return categories.map((category) => ({
		...category,
		translations: labels.filter((row) => row.categoryId === category.id),
		posts: Number(usage.find((row) => row.categoryId === category.id)?.posts ?? 0)
	}));
});

const categorySchema = v.object({
	id: optionalText(64),
	slug: optionalText(80),
	accent: v.picklist(ACCENTS),
	sortOrder: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999)), 0),
	translations: v.array(v.object({ locale: localeArg, label: optionalText(120) }))
});

/** As `postSlugTaken`, for the machine name a category shares across locales. */
async function categorySlugTaken(categoryId: string, slug: string): Promise<boolean> {
	const [clash] = await db
		.select({ id: blogCategory.id })
		.from(blogCategory)
		.where(and(eq(blogCategory.slug, slug), ne(blogCategory.id, categoryId)))
		.limit(1);

	return Boolean(clash);
}

export const saveCategory = form(categorySchema, async (data, issue) => {
	requireAdmin();

	const seen = new Set<string>();
	const entries = data.translations
		.map((translation, index) => ({ index, ...translation }))
		.filter((entry) => {
			if (seen.has(entry.locale)) return false;
			seen.add(entry.locale);
			return true;
		});

	const base = entries.find((entry) => entry.locale === baseLocale);

	if (!base || !base.label) {
		invalid(issue.translations[base?.index ?? 0].label(m.admin_required_field()));
	}

	// Unlike a post's slug this one is shared by every locale - it is the
	// category's machine name, not a readable URL.
	const slug = slugify(data.slug || base.label);

	if (!slug) invalid(issue.slug(m.admin_required_field()));

	const categoryId = data.id || crypto.randomUUID();

	if (data.id) {
		const [stored] = await db
			.select({ id: blogCategory.id })
			.from(blogCategory)
			.where(eq(blogCategory.id, data.id))
			.limit(1);

		// Same reason as in `savePost`: an UPDATE that matches nothing is silent,
		// and the loop below would then write labels for a category that is gone.
		if (!stored) error(404, m.error_404_title());
	}

	if (await categorySlugTaken(categoryId, slug)) {
		invalid(issue.slug(m.admin_blog_category_slug_taken()));
	}

	const shared = { slug, accent: data.accent, sortOrder: data.sortOrder };

	try {
		if (data.id) {
			await db.update(blogCategory).set(shared).where(eq(blogCategory.id, categoryId));
		} else {
			await db.insert(blogCategory).values({ id: categoryId, ...shared });
		}
	} catch (cause) {
		// `blog_category.slug` is unique in the database as well, and the check
		// above is a separate request, so a save running alongside this one can
		// still have taken the slug first.
		if (await categorySlugTaken(categoryId, slug)) {
			invalid(issue.slug(m.admin_blog_category_slug_taken()));
		}

		throw cause;
	}

	const existingLocales = await db
		.select({ locale: blogCategoryTranslation.locale })
		.from(blogCategoryTranslation)
		.where(eq(blogCategoryTranslation.categoryId, categoryId));

	for (const entry of entries) {
		if (existingLocales.some((row) => row.locale === entry.locale)) {
			await db
				.update(blogCategoryTranslation)
				.set({ label: entry.label })
				.where(
					and(
						eq(blogCategoryTranslation.categoryId, categoryId),
						eq(blogCategoryTranslation.locale, entry.locale)
					)
				);
		} else {
			await db
				.insert(blogCategoryTranslation)
				.values({ categoryId, locale: entry.locale, label: entry.label });
		}
	}

	await listCategoriesForAdmin().refresh();
	// A category's colour and label ride along with every post row.
	await listPostsForAdmin().refresh();
	await refreshPublicBlog();

	return { ok: true as const, id: categoryId };
});

export const deleteCategory = command(idArg, async (id) => {
	requireAdmin();

	const [used] = await db
		.select({ posts: count() })
		.from(blogPost)
		.where(eq(blogPost.categoryId, id));

	// `blog_post.category_id` is ON DELETE SET NULL, so deleting a category in
	// use would quietly strip the colour off its posts instead of failing.
	if (Number(used?.posts ?? 0) > 0) {
		return { ok: false as const, message: m.admin_blog_category_in_use() };
	}

	await db.delete(blogCategoryTranslation).where(eq(blogCategoryTranslation.categoryId, id));
	await db.delete(blogCategory).where(eq(blogCategory.id, id));

	await listCategoriesForAdmin().refresh();
	await listPostsForAdmin().refresh();
	await refreshPublicBlog();

	return { ok: true as const };
});
