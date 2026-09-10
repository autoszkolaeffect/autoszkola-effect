import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	// --- public -------------------------------------------------------------
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	CLOUDFLARE_ACCOUNT_ID: {
		description:
			'Cloudflare account that owns the D1 database. Dashboard sidebar, or `npx wrangler whoami`.'
	},
	CLOUDFLARE_DATABASE_ID: {
		description: 'D1 database ID. Storage & Databases -> D1 -> your database -> Database ID.'
	},
	TURNSTILE_SITE_KEY: {
		public: true,
		description:
			'Cloudflare Turnstile site key. Rendered into the contact form widget, so it is public by design. Pairs with `TURNSTILE_SECRET_KEY`.'
	},

	// --- secret -------------------------------------------------------------
	CLOUDFLARE_D1_TOKEN: {
		description:
			'Cloudflare API token with the account-scoped D1:Edit permission. Used to reach D1 over its REST API.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	TURNSTILE_SECRET_KEY: {
		description:
			'Cloudflare Turnstile secret key. Used server-side to verify the token the contact form widget produces.'
	},
	SETTINGS_ENCRYPTION_KEY: {
		description:
			"Base64url-encoded 32-byte key used to encrypt secrets the admin panel stores in the database (currently the SMTP password). Changing it makes existing stored secrets unreadable. Generate with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"`."
	}
});
