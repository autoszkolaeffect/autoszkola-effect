// Compiles messages/*.json into src/lib/paraglide.
//
// `npm run dev` and `npm run build` already do this through the Vite plugin;
// this exists so `npm run check` and CI can compile without starting Vite.
//
// Do NOT reach for `npx @inlang/paraglide-js compile` instead: the CLI knows
// nothing about the options in paraglide.config.js, and compiling without them
// produces a runtime that works but silently stops prefixing the base locale.

import { compile } from '@inlang/paraglide-js';
import { paraglideOptions } from '../paraglide.config.js';

await compile(paraglideOptions);

console.log('Compiled messages into', paraglideOptions.outdir);
