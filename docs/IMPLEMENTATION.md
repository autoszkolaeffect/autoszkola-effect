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
`/pl/contact` is served by `src/routes/(site)/contact/+page.svelte`.

Always build links with `localizeHref('/contact')`, never a bare `/contact`.

Route segments and query parameters are English (`/pl/instructors`,
`/pl/blog?category=…`, `/pl/admin/messages?filter=archived`), including the
`new` segment the create forms sit on. Only content is Polish - blog slugs come
from the post title and are stored per locale, so they follow the language they
were written in rather than this rule.

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

- Square corners. The only radius in the design is `rounded-pill` (2px), on nav pills.
- Emphasis comes from coloured edges (`border-l-4 border-red`,
  `border-t-3 border-yellow`), never shadows.
- Headings use `font-display` (applied automatically to `h1`-`h4` in base CSS).
- **No arbitrary values.** There are no `[...]` utilities in the markup at all.
  Where Tailwind's own scale has the value, use it (`max-w-275`, `border-t-3`,
  `tracking-widest`, `leading-normal`); where it does not, the value is a theme
  token or an `@utility` in `src/routes/layout.css` (`text-caption`,
  `leading-body`, `px-tag`, `grid-cards`, `bg-hero-scrim`). Adding a
  one-off size straight into a component is the thing not to do - either an
  existing token fits, or the design has a new size that belongs in the theme.
  The single value that can be neither is an instructor's stored colour, which
  is not known until the row is read - see [Accent colours](#accent-colours).
- **Every length is relative.** Sizes, spacing, tracking and grid wrap points are
  all `rem` (line heights unitless, headings fluid `clamp()`), so a reader who
  enlarges their browser font gets a layout that grows with it rather than one
  pinned to pixels. Do not reintroduce `px` in a token.
- A `--text-*` token has no `--line-height` companion on purpose: `text-caption`
  sets the size alone and leaves leading to a `leading-*` utility. Tailwind's own
  `text-sm` bundles a line-height, which is why the stock steps are not used for
  body copy here.
- The breakpoint between the mobile and desktop layouts is `md` (768px).

## Icons

Every icon comes from `@lucide/svelte`, imported as a named component:

```svelte
<script lang="ts">
	import { ArrowUp } from '@lucide/svelte';
</script>

<button aria-label={m.admin_move_up()}>
	<ArrowUp class="size-4" aria-hidden="true" />
</button>
```

- Size them with a `size-*` class on `class`, never the component's numeric
  `size` prop - that prop writes `width` and `height` in px, and every length
  here is relative, so an icon should grow with the text beside it.
- They paint in `currentColor`, so the colour comes from the parent's `text-*`
  rather than a prop.
- An icon inside a control that already carries an `aria-label` or visible text
  is `aria-hidden="true"` - it only repeats what the label already says.
- A message string is words only. The arrow on a call to action or a back link
  is an `ArrowRight`/`ArrowLeft` beside the label in the markup, not a `→`
  inside the string: the catalogue then reads as prose, and the icon takes the
  control's `gap` instead of a space character of whatever width the font
  gives it. `.btn` is already `inline-flex` with a gap; a plain link gets
  `inline-flex items-center gap-1` (or `gap-2`) for the same reason.

Both the site and the panel used bare text characters for this (`↑`, `☰`, `★`,
an emoji on the home page). They resolve to a different glyph on every platform,
or to none at all when the font lacks them, and a screen reader announces them
as the characters they are.

## Deliberate deviations from the design

docs/DESIGN.md records what the prototype does. These are the places we knowingly
do something else, so they do not read as mistakes:

- **Faint body text.** The design sets the blog card's date to
  `rgba(250,250,250,.4)` on the blue card, which measures 2.74:1 against it - well
  under the 4.5:1 AA needs. Content text uses at least `text-paper/70` (5.27:1).
  The `/40` and `/35` values are kept only for genuinely decorative text.
- **Navy badge text on orange.** The design gives the instructor cycle yellow
  with navy text and white text on the last three. An instructor badge's text
  colour is computed from the accent's luminance rather than tabulated, so the
  orange card's badge is navy where the design draws it white - white on
  `#f77f00` measures 2.52:1, against the 4.5:1 AA asks of normal-size text.
  Orange blog-category chips took navy with it, so one colour does not read two
  ways on two screens.
- **Focus rings.** The prototype has no focus styling at all. Everything focusable
  gets the yellow `:focus-visible` ring from the base layer.
- **Carousel controls.** The prototype auto-advances with no way to stop it. Ours
  pauses on hover and focus, offers an explicit control, and does not auto-advance
  under `prefers-reduced-motion`.
- **Carousel author dash.** The design renders `- Marta K.`, with the dash in the
  markup and the name alone in the data. Keep it that way: the admin panel's hint
  asks for the name without a dash.
- **Half-star ratings.** The design draws five whole `★` characters and seeds
  every opinion at five. `opinion.rating` is a `real` from 0 to 5 in steps of
  0.5, typed into a number input in the panel rather than picked from a list of
  star strings, and drawn by `src/lib/components/Stars.svelte` as five Lucide
  slots - full, half or empty.
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

- **Instructor cards** take the colour stored on `instructor.accent` as
  `#rrggbb`, which the panel's colour picker writes. NULL means automatic, and
  an automatic card follows its position in the grid - index 0 yellow, 1 red,
  2 blue, 3 orange, then repeat - so reordering still re-colours every
  instructor nobody has chosen a colour for. `instructorAccentHex()` is the one
  place that rule lives; call it rather than deriving the fallback again.
- **Blog categories** store their own accent (`red` / `yellow` / `blue` /
  `orange`) on `blog_category.accent`. Yellow and orange take navy text, red and
  blue paper.

Both rules live in `src/lib/accents.ts` - import them rather than repeating the
conditional.

The text a category chip takes is written down only because there are four of
them. An instructor's colour can be anything, so the text on top is computed
from the colour's relative luminance by `accentForeground()` and reaches the
card as `--accent-on` - and the four tabulated pairings are exactly what that
function returns for the four hexes, so a colour cannot read one way as a chip
and another as a badge. Nothing here is "yellow is the dark-text one": orange is
too, and an arbitrary picked colour lands wherever its luminance puts it.
`accentMeetsAA()` is the other half of the same sum - picking the better of two
foregrounds still fails AA for mid-tones, so the panel's colour field warns when
the chosen accent cannot carry legible text either way.

That colour also cannot be a Tailwind class: the class would have to exist
before the row is read. The card carries it as custom properties instead, set
with Svelte `style:` directives, and three utilities in `src/routes/layout.css`
read them anywhere inside it:

```svelte
<article style:--accent={hex} style:--accent-on={accentForeground(hex)}>
	<p class="bg-accent px-tag text-on-accent">{instructor.badge}</p>
</article>
```

`bg-accent`, `border-accent` and `text-on-accent` are not a way around the
no-arbitrary-values rule - they are how it holds for a value only known at
runtime. The markup still names a utility; only the colour arrives late. A
length or colour known while writing the component still belongs in the theme.

## Admin panel

Lives under `src/routes/admin/`:

- `admin/login/` - the sign-in page, deliberately outside the guard.
- `admin/(panel)/+layout.server.ts` - redirects to the login page when there is
  no session.
- `admin/(panel)/...` - everything else.

There is no sign-up. Accounts exist only because `npm run db:seed` created them.

Admin URLs are locale-prefixed: `/pl/admin`, `/pl/admin/instructors`,
`/pl/admin/blog`, `/pl/admin/opinions`, `/pl/admin/contact`,
`/pl/admin/messages`, `/pl/admin/smtp`.

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
