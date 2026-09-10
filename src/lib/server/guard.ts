import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/**
 * Asserts that the caller is signed in, and returns the signed-in user.
 *
 * Every admin remote function calls this. The layout guard in
 * `src/routes/admin/+layout.server.ts` keeps the panel's pages behind a login,
 * but remote functions are separately addressable endpoints - a page guard does
 * nothing for them, so each one has to check for itself.
 *
 * Throws 401 rather than redirecting: the caller is a `fetch`, not a document
 * request, so a redirect to the login page would be answered with the login
 * page's HTML instead of an error the client can act on.
 */
export function requireAdmin() {
	const { locals } = getRequestEvent();

	if (!locals.user || !locals.session) {
		error(401, 'Wymagane zalogowanie.');
	}

	return locals.user;
}
