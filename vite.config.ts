import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { paraglideOptions } from './paraglide.config.js';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true }
			},

			// The Node runtime is required, not the edge one: nodemailer opens an
			// SMTP socket, which edge functions cannot do.
			adapter: adapter({ runtime: 'nodejs22.x' }),
			experimental: { remoteFunctions: true }
		}),

		// Options live in paraglide.config.js so `npm run messages` compiles with
		// exactly the same ones - see the comment there.
		paraglideVitePlugin(paraglideOptions)
	]
});
