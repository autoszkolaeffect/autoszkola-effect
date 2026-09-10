/**
 * Paraglide compiler options, shared by the Vite plugin and `npm run messages`.
 *
 * These live here rather than inline in vite.config.ts because compiling with a
 * different set of options silently produces a *working but wrong* runtime -
 * notably `urlPatterns`, without which the compiler tree-shakes to its default
 * pattern and stops prefixing the base locale, so every `localizeHref('/blog')`
 * quietly returns `/blog` instead of `/pl/blog`. One definition, no drift.
 */
export const paraglideOptions = {
	project: './project.inlang',
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,

	// `url` first so the locale is read from the path, and so the middleware
	// redirects an unprefixed URL to its localized form. `cookie` and `baseLocale`
	// only come into play for a request that carries no locale in its URL at all.
	strategy: ['url', 'cookie', 'baseLocale'],

	// Paraglide leaves the base locale unprefixed by default. We want every public
	// URL to carry its locale - `/pl/blog`, never `/blog` - so the base locale gets
	// an explicit pattern too. Adding a locale here is the only change needed to
	// give it its own prefix.
	urlPatterns: [
		{
			pattern: ':protocol://:domain(.*)::port?/:path(.*)?',
			localized: [['pl', ':protocol://:domain(.*)::port?/pl/:path(.*)?']]
		}
	],

	// Endpoints that are not pages must never be rewritten or redirected:
	// better-auth lives under /api/auth, and SvelteKit's remote functions and
	// client assets under /_app.
	routeStrategies: [
		{ match: '/api/:path(.*)?', exclude: true },
		{ match: '/_app/:path(.*)?', exclude: true }
	]
};
