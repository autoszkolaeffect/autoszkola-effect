import { redirect } from '@sveltejs/kit';

import { localizeHref } from '#lib/paraglide/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		// `url` is still the localized one the browser asked for - `reroute` only
		// de-localizes for route matching - so this sends the visitor back exactly
		// where they were once they sign in.
		const target = encodeURIComponent(url.pathname + url.search);

		redirect(303, `${localizeHref('/admin/login')}?redirectTo=${target}`);
	}

	// Only what the sidebar shows; the rest of the session record has no business
	// in the page payload.
	return { user: { id: locals.user.id, name: locals.user.name, email: locals.user.email } };
};
