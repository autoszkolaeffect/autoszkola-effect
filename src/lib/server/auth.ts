import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db';

const authConfig = {
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	// `disableSignUp` is the load-bearing part. better-auth registers
	// POST /api/auth/sign-up/email as soon as email+password is enabled, and that
	// route auto-signs-in the account it creates. Since this app has no roles -
	// `requireAdmin()` asks only whether a session exists - leaving it on would let
	// anyone curl themselves an admin account. Accounts come from `npm run db:seed`
	// and nowhere else.
	emailAndPassword: { enabled: true, disableSignUp: true },
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = () =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(db, { provider: 'sqlite' })
	});

export const auth = createAuth();
