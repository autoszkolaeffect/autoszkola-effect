import { fail, redirect } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';
import { localizeHref } from '#lib/paraglide/runtime';
import * as m from '#lib/paraglide/messages';
import type { Actions, PageServerLoad } from './$types';

// Any origin will do: the parsed URL is only compared against it and then thrown
// away, so a name that can never resolve keeps it obvious that nothing is fetched.
const REDIRECT_BASE = 'http://redirect.invalid';

/**
 * `?redirectTo=` comes off the guard, which puts the path the visitor asked for
 * there. Only a same-origin path is honoured, so a crafted link cannot bounce a
 * freshly signed-in admin to another site.
 *
 * Control characters go first: a browser deletes tab, newline and carriage
 * return while parsing a URL and trims the rest, so `/<tab>/evil.example` reads
 * as `//evil.example` - an absolute URL - even though the raw string passes a
 * "starts with a single slash" test. What survives has to parse to a path on
 * this origin, which is also what closes `/\host`, the parser treating a
 * backslash as a slash.
 */
function safeRedirect(value: string | null): string {
	const fallback = localizeHref('/admin');
	if (!value) return fallback;

	const cleaned = value.replace(/\p{Cc}/gu, '').trim();

	if (!cleaned.startsWith('/') || cleaned.startsWith('//') || cleaned.startsWith('/\\')) {
		return fallback;
	}

	let parsed: URL;

	try {
		parsed = new URL(cleaned, REDIRECT_BASE);
	} catch {
		// `URL` is the check itself here - a string it refuses to parse is exactly
		// the input that must not be handed to `redirect()`.
		return fallback;
	}

	if (parsed.origin !== REDIRECT_BASE) return fallback;

	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

// Password attempts are counted in module memory as a fixed window. better-auth's
// own rate limiter only guards requests that go through its /api/auth router, and
// this action calls the API directly, so without this password guessing is
// unthrottled. The counter is per instance and a cold start clears it - on
// serverless that makes it a speed bump, not a guarantee.
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_LIMIT = 8;
// Both halves of the key come from the request, so the map is swept before it can
// be grown without bound by varying the submitted address.
const TRACKED_KEYS_LIMIT = 5000;

const attempts = new Map<string, { count: number; expiresAt: number }>();

/** Records one attempt and reports whether the window is now exhausted. */
function attemptExceeded(key: string): boolean {
	const now = Date.now();
	const current = attempts.get(key);

	if (!current || current.expiresAt <= now) {
		pruneAttempts(now);
		attempts.set(key, { count: 1, expiresAt: now + ATTEMPT_WINDOW_MS });

		return false;
	}

	current.count += 1;

	return current.count > ATTEMPT_LIMIT;
}

function pruneAttempts(now: number): void {
	if (attempts.size < TRACKED_KEYS_LIMIT) return;

	for (const [key, entry] of attempts) {
		if (entry.expiresAt <= now) attempts.delete(key);
	}

	// Still full means the live windows themselves are the flood; dropping the
	// oldest keeps memory bounded and costs an attacker their own counters too.
	for (const key of attempts.keys()) {
		if (attempts.size < TRACKED_KEYS_LIMIT) break;
		attempts.delete(key);
	}
}

/**
 * `getClientAddress()` throws on adapters that cannot determine an address. The
 * throttle then keys on the submitted address alone rather than failing the
 * sign-in outright.
 */
function throttleKey(getClientAddress: () => string, email: string): string {
	let address: string;

	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}

	return `${address}|${email.toLowerCase().slice(0, 180)}`;
}

export const load: PageServerLoad = ({ locals, url }) => {
	const redirectTo = url.searchParams.get('redirectTo');

	if (locals.user) redirect(303, safeRedirect(redirectTo));

	return { redirectTo: redirectTo ?? '' };
};

export const actions: Actions = {
	login: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const target = safeRedirect(String(data.get('redirectTo') ?? '') || null);

		if (!email || !password) {
			return fail(400, { email, error: m.admin_login_failed() });
		}

		const key = throttleKey(getClientAddress, email);

		if (attemptExceeded(key)) {
			return fail(429, { email, error: m.admin_login_throttled() });
		}

		try {
			// The sveltekitCookies plugin writes the session cookie onto the
			// response for us, so there is nothing to forward by hand.
			await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch {
			// An unknown address, a wrong password and a locked account all throw the
			// same way here, and all get the same answer - the form must not become a
			// way to find out which addresses exist.
			return fail(400, { email, error: m.admin_login_failed() });
		}

		// A sign-in that worked ends the window, so an admin who mistyped a few
		// times is not held to the count for the rest of it.
		attempts.delete(key);

		redirect(303, target);
	},

	/**
	 * The sign-out control lives in the panel's sidebar, which is a layout - and
	 * layouts cannot host form actions. It posts here instead, which is where
	 * signing out lands anyway.
	 */
	logout: async ({ request, locals }) => {
		if (locals.session) {
			await auth.api.signOut({ headers: request.headers });
		}

		redirect(303, localizeHref('/admin/login'));
	}
};
