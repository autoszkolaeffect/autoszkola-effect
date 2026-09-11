import { defineParams } from '@sveltejs/kit/params';
import * as v from 'valibot';

// SvelteKit reads every param matcher from this one module - and at build time
// it loads the file with a plain Node `import()`, outside Vite. That is why the
// list below lives here rather than in src/lib/seo.ts: a `#lib/*` specifier has
// no file extension for Node to resolve, and the paraglide modules behind it
// are not something a matcher should drag into the router anyway.

/**
 * The static public pages with an Open Graph card, `/og/{locale}/{page}.png`.
 * English, like every other route segment.
 */
export const ogPages = ['home', 'instructors', 'blog', 'contact'] as const;

export type OgPage = (typeof ogPages)[number];

// A matcher can be a standard schema, so the segment is checked the same way
// remote function arguments are - and `params.page` comes out typed as the
// union rather than as a string.
export const params = defineParams({
	ogPage: v.picklist(ogPages)
});
