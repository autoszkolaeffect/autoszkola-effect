import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getTextDirection } from '#lib/paraglide/runtime';
import { paraglideMiddleware } from '#lib/paraglide/server';

// `reroute` in src/hooks.ts already de-localizes the URL, so SvelteKit handles URL
// localization itself. Per the Paraglide docs we therefore resolve the original event
// rather than the middleware's rewritten `request` - using both would de-localize twice
// and can cause redirect loops. The middleware still provides locale detection,
// cookies and the AsyncLocalStorage context that message functions rely on.
const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) => {
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	event.locals.auth = auth;

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// The panel's layout already carries `<meta name="robots">`, but a crawler only
// sees that on a page it renders. The header covers every response under the
// panel - the redirect to the login page, form actions, an error before the head
// is written - so nothing behind it is indexed by accident. Route ids are
// un-localized, so `/pl/admin/...` still starts with `/admin`.
const handleRobots: Handle = ({ event, resolve }) => {
	if (event.route.id?.startsWith('/admin')) {
		event.setHeaders({ 'X-Robots-Tag': 'noindex, nofollow' });
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleBetterAuth, handleRobots);
