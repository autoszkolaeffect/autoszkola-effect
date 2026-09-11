import { error } from '@sveltejs/kit';

import * as m from '#lib/paraglide/messages';
import { isLocale, type Locale } from '#lib/paraglide/runtime';
import { getSiteContact } from '#lib/remote/site.remote';
import type { OgPage } from '#lib/seo';
import { renderOgImage, type OgCardInput } from '#lib/server/og/render';
import { ogImageResponse } from '#lib/server/og/response';
import type { RequestHandler } from './$types';

// Open Graph card for a static public page: /og/{locale}/{page}.png.
//
// The route sits outside Paraglide's URL strategy (see paraglide.config.js),
// so the ambient locale here is always the base locale. Every message call
// therefore names the locale from the URL explicitly.

export const GET: RequestHandler = async ({ params, url }) => {
	if (!isLocale(params.locale)) error(404);

	const card = await pageCard(params.page, params.locale);

	return ogImageResponse(await renderOgImage({ ...card, host: url.hostname }));
};

type PageCard = Omit<OgCardInput, 'host'>;

async function pageCard(page: OgPage, locale: Locale): Promise<PageCard> {
	const options = { locale };

	switch (page) {
		case 'home':
			// The tagline rather than the site description, which restates the
			// ranking the title already makes.
			return {
				eyebrow: m.hero_badge({}, options),
				title: [
					m.hero_title_line1({}, options),
					m.hero_title_line2({}, options),
					m.hero_title_line3({}, options)
				].join(' '),
				subtitle: m.home_title({}, options)
			};
		case 'instructors':
			return {
				eyebrow: m.site_name({}, options),
				title: m.instructors_title({}, options),
				subtitle: m.instructors_intro({}, options)
			};
		case 'blog':
			return {
				eyebrow: m.site_name({}, options),
				title: m.blog_title({}, options),
				subtitle: m.blog_intro({}, options)
			};
		case 'contact': {
			// The contact page's heading and intro are admin-edited; the catalogue
			// only steps in while they are still blank.
			const contact = await getSiteContact(locale);

			return {
				eyebrow: m.site_name({}, options),
				title: contact.pageTitle || m.nav_contact({}, options),
				subtitle: contact.pageIntro || m.site_description({}, options)
			};
		}
	}
}
