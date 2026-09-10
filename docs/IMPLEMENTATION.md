# Implementation conventions

Read this together with [DESIGN.md](DESIGN.md), which is the authority on every
visual value. This file is the authority on how the code is organised.

## Stack

SvelteKit 3 (next) on Vercel with the Node runtime, Svelte 5 in **runes mode with
async mode on**, Tailwind 4, Paraglide 2, better-auth, Drizzle over Cloudflare D1
reached through its REST API (`drizzle-orm/sqlite-proxy`).

Because async mode is on, a component may `await` at the top level of its
`<script>`. That is the intended way to read a remote query:

```svelte
<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime';
	import { listInstructors } from '#lib/remote/site.remote';

	const instructors = await listInstructors(getLocale());
</script>
```

`#lib/*` maps to `src/lib/*` (see `imports` in package.json and `paths` in
tsconfig.json). Import without a file extension.

## Locale

One locale, `pl`, and every public URL carries it: `/pl`, `/pl/blog`,
`/pl/admin`. Paraglide's `url` strategy does the redirecting, and `src/hooks.ts`
de-localizes before routing - so **route folders have no `[locale]` segment**.
`/pl/kontakt` is served by `src/routes/(site)/kontakt/+page.svelte`.

Always build links with `localizeHref('/kontakt')`, never a bare `/kontakt`.

Adding a locale means adding it to `project.inlang/settings.json` and to
`urlPatterns` in `paraglide.config.js`. Nothing else should need to change, which
is why:

- Content is stored as a base row plus one translation row per locale.
- `src/lib/locales.ts` exposes `contentLocales`, `byLocale()` and
  `pickTranslation()`. Admin editors render one section per entry in
  `contentLocales`; they must never hard-code `pl`.
- Public queries take an explicit `locale` argument and fall back to the base
  locale in SQL.

## Messages

All user-visible text goes through Paraglide: `import * as m from
'#lib/paraglide/messages'`, then `m.some_key()`. `messages/pl.json` already
holds the full catalogue, admin panel included.

**Do not edit `messages/pl.json`** - several tasks run in parallel and would
clobber each other. If a key you need is genuinely missing, write the Polish
string inline and leave a marker:

```svelte
<!-- TODO(i18n): admin_blog_duplicate -->
<span>Duplikuj wpis</span>
```

These are swept into the catalogue in a single pass afterwards.

After changing `messages/pl.json` (only the sweep does), recompile with:

```bash
npm run messages
```

Never use `npx @inlang/paraglide-js compile` directly. The CLI knows nothing about
the options in `paraglide.config.js`, and compiling without `urlPatterns` produces a
runtime that works but silently stops prefixing the base locale - every
`localizeHref('/blog')` quietly returns `/blog` instead of `/pl/blog`.

## Data access

Everything goes through **remote functions** (`*.remote.ts`), not `load`
functions. `src/lib/remote/site.remote.ts` holds the public read queries and the
contact form; each admin domain gets its own module under `src/lib/remote/`.

- `query(schema, fn)` for reads. Validate arguments with valibot - a remote
  function is a public endpoint, so its arguments are untrusted.
- `form(schema, fn)` for anything driven by a `<form>`. Use `invalid()` from
  `@sveltejs/kit` and the `issue` proxy for field-level errors.
- `command(schema, fn)` for imperative mutations (reordering, marking read).
- Call `requireAdmin()` from `#lib/server/guard` as the **first statement** of
  every admin remote function. The layout guard does not protect them; they are
  separately addressable endpoints.
- After a mutation, refresh what changed: `await someQuery().refresh()` on the
  server inside the handler, or `.updates(someQuery())` at the call site.

Shared valibot pieces live in `src/lib/remote/schema.ts`.

## Styling

Tailwind 4 with the palette and fonts registered as theme tokens in
`src/routes/layout.css`: `bg-navy`, `bg-navy-deep`, `bg-blue`, `bg-red`,
`bg-yellow`, `bg-orange`, `text-paper`, `font-display`, `font-body`. Opacity
modifiers work (`text-paper/80`, `bg-navy/55`).

Component classes already defined there: `.section-rule` (the 48x5 bar - pair
with a `bg-*`), `.eyebrow`, `.field`, `.btn` plus `.btn-red` / `.btn-yellow` /
`.btn-ghost`, and `.markdown-body` for rendered markdown.

Rules of thumb:

- Square corners. The only radius in the design is `rounded-[2px]`, on nav pills.
- Emphasis comes from coloured edges (`border-l-4 border-red`,
  `border-t-[3px] border-yellow`), never shadows.
- Headings use `font-display` (applied automatically to `h1`-`h4` in base CSS).
- Arbitrary values are fine where the design is specific:
  `text-[clamp(2rem,5vw,3.2rem)]`, `leading-[1.68]`.
- The breakpoint between the mobile and desktop layouts is `md` (768px).

## Deliberate deviations from the design

docs/DESIGN.md records what the prototype does. These are the places we knowingly
do something else, so they do not read as mistakes:

- **Faint body text.** The design sets the blog card's date to
  `rgba(250,250,250,.4)` on the blue card, which measures 2.74:1 against it - well
  under the 4.5:1 AA needs. Content text uses at least `text-paper/70` (5.27:1).
  The `/40` and `/35` values are kept only for genuinely decorative text.
- **Focus rings.** The prototype has no focus styling at all. Everything focusable
  gets the yellow `:focus-visible` ring from the base layer.
- **Carousel controls.** The prototype auto-advances with no way to stop it. Ours
  pauses on hover and focus, offers an explicit control, and does not auto-advance
  under `prefers-reduced-motion`.
- **Carousel author dash.** The design renders `- Marta K.`, with the dash in the
  markup and the name alone in the data. Keep it that way: the admin panel's hint
  asks for the name without a dash.
- **Contact form success state.** The prototype has none; ours replaces the form
  with a confirmation panel in the same visual language.
- **The copyright year** is the current year, not the design's hard-coded 2024.
- **Card grid minimums.** The design's `minmax(300px, 1fr)` / `minmax(320px, 1fr)`
  tracks cannot fit a 320px phone, where the content box is 272px - the cards
  spill out of the page. The public grids wrap the minimum in `min(…, 100%)`, so
  the track collapses instead. Identical at every width where the design works.
- **The map iframe is sandboxed** and its URL is restricted to `https:`. The embed
  URL is admin-editable and goes straight into a frame `src`, where `javascript:`
  runs in this page's context - so a panel account must not be a route to script
  execution on the public site.

## Accent colours

- **Instructor cards** cycle by position: index 0 yellow, 1 red, 2 blue,
  3 orange, then repeat. Yellow badges take navy text; the other three take
  paper. Derive this from the index - it is not stored.
- **Blog categories** store their own accent (`red` / `yellow` / `blue` /
  `orange`) on `blog_category.accent`. Yellow takes navy text, the rest paper.

Put the mapping in one helper and import it rather than repeating the
conditional.

## Admin panel

Lives under `src/routes/admin/`:

- `admin/login/` - the sign-in page, deliberately outside the guard.
- `admin/(panel)/+layout.server.ts` - redirects to the login page when there is
  no session.
- `admin/(panel)/...` - everything else.

There is no sign-up. Accounts exist only because `npm run db:seed` created them.

Admin URLs are Polish and locale-prefixed: `/pl/admin`, `/pl/admin/instruktorzy`,
`/pl/admin/blog`, `/pl/admin/opinie`, `/pl/admin/kontakt`,
`/pl/admin/wiadomosci`, `/pl/admin/poczta`.

The panel uses the same palette as the public site but a denser, plainer layout:
navy page, `bg-blue` cards, `.field` inputs, `.btn-*` buttons. It is a working
tool, not a landing page.

## Photos

Instructor photos are stored as `data:image/...;base64,...` in
`instructor.photo`. A D1 row cannot exceed 1 MB, so the admin form downscales in
the browser with a canvas before upload (longest edge 800px, JPEG quality ~0.72)
and rejects anything still over the limit afterwards.

## House style

- Tabs for indentation, single quotes, semicolons - Prettier config is in the
  repo, run `npm run format` when done.
- Comments explain _why_, not _what_, and only where a reader would otherwise
  wonder. Match the density of the existing files.
- No `any`. No `!` non-null assertions where a check would do.
- Prefer `$derived` over `$effect`. Reach for `$effect` only for genuine side
  effects such as timers.
