import { error } from '@sveltejs/kit';

import { formatLongDate } from '#lib/format';
import * as m from '#lib/paraglide/messages';
import { isLocale } from '#lib/paraglide/runtime';
import { getBlogPost } from '#lib/remote/site.remote';
import { renderOgImage } from '#lib/server/og/render';
import { ogImageResponse } from '#lib/server/og/response';
import type { RequestHandler } from './$types';

// Open Graph card for a blog article: /og/{locale}/blog/{slug}.png.
//
// Outside Paraglide's URL strategy like the page cards, so the locale comes
// from the URL and is passed on explicitly. The slug goes nowhere but into the
// query, which validates it and answers with the post or nothing.

export const GET: RequestHandler = async ({ params, url }) => {
	if (!isLocale(params.locale)) error(404);

	const locale = params.locale;
	const post = await getBlogPost({ locale, slug: params.slug });

	if (!post) error(404);

	const caption = [
		formatLongDate(post.publishedAt, locale),
		m.blog_reading_time_long({ minutes: post.readingMinutes }, { locale })
	]
		.filter((part) => part !== '')
		.join(' · ');

	const png = await renderOgImage({
		eyebrow: post.categoryLabel || m.blog_title({}, { locale }),
		title: post.title,
		subtitle: post.description,
		host: url.hostname,
		caption
	});

	return ogImageResponse(png);
};
