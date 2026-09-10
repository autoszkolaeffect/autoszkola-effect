# Auto Szkoła Efekt

The website for Auto Szkoła Efekt in Łódź: a Polish-language landing page with an
admin panel behind it, so the school can edit its instructors, blog, opinions and
contact details without a deploy.

## Stack

|           |                                                                             |
| --------- | --------------------------------------------------------------------------- |
| Framework | SvelteKit (next) · Svelte 5, runes + async mode                             |
| Styling   | Tailwind 4, palette and fonts as theme tokens                               |
| i18n      | Paraglide 2 — one locale (`pl`), carried in the URL as `/pl/...`            |
| Database  | Cloudflare D1, reached over its REST API through `drizzle-orm/sqlite-proxy` |
| Auth      | better-auth, email + password, no sign-up                                   |
| Mail      | nodemailer, configured from the admin panel                                 |
| Spam      | Cloudflare Turnstile on the contact form                                    |
| Hosting   | Vercel, Node runtime                                                        |

## Getting started

```bash
npm install
cp .env.example .env.dev     # then fill it in - see the comments in the file
npm run db:migrate           # create the tables in the dev D1 database
npm run db:seed              # create your admin account (see below)
npm run db:seed:content      # load the site's starting content
npm run dev
```

The site is at <http://localhost:5173/pl> and the admin panel at
<http://localhost:5173/pl/admin>.

### Admin accounts

There is no sign-up page. An account exists only because it was seeded:

```bash
cp seed/accounts.example.json seed/accounts.json   # gitignored - holds plaintext passwords
# edit it, then
npm run db:seed
```

Re-running is safe: an address that already exists is skipped, never overwritten.

## Layout

```
docs/DESIGN.md            the visual specification, extracted from the Figma design
docs/IMPLEMENTATION.md    how the code is organised - read before changing anything
messages/pl.json          every user-visible string
seed/content/             the starting content: blog posts as markdown, instructor photos
src/lib/remote/           remote functions - all data access goes through these
src/lib/server/           database, auth, mail, Turnstile, secret encryption
src/routes/(site)/        the public site
src/routes/admin/         the admin panel
```

## Content model

Everything editable is split in two: a base row with the locale-independent facts
(ordering, photo, dates, status) and one translation row per locale with the words.
Adding a locale is a change to `project.inlang/settings.json` and `paraglide.config.js`,
not a migration — the admin panel grows a section for the new locale and fills in
the missing rows as content is saved.

Instructor photos are stored as base64 data URLs in the database. The admin form
downscales them in the browser first, because a D1 row cannot exceed 1 MB.

## Commands

|                                     |                                                         |
| ----------------------------------- | ------------------------------------------------------- |
| `npm run dev`                       | dev server against the dev database                     |
| `npm run messages`                  | compile `messages/*.json` into message functions        |
| `npm run check`                     | compile messages, then type-check (`svelte-check`)      |
| `npm run lint` / `npm run format`   | Prettier + ESLint                                       |
| `npm run db:generate`               | generate a migration from `src/lib/server/db/schema.ts` |
| `npm run db:migrate` / `:prod`      | apply migrations                                        |
| `npm run db:seed` / `:prod`         | create admin accounts from `seed/accounts.json`         |
| `npm run db:seed:content` / `:prod` | load the starting site content                          |
| `npm run db:studio`                 | browse the database                                     |

After editing `messages/pl.json`, recompile the message functions:

```bash
npm run messages
```

`npm run dev`, `npm run build` and `npm run check` do this for you. Do not call the
paraglide CLI directly — it does not read `paraglide.config.js`, and a runtime
compiled without those options stops prefixing the base locale.

## Deploying

The app targets Vercel with `@sveltejs/adapter-vercel` on the Node runtime — the
edge runtime cannot open the SMTP socket nodemailer needs.

Set every variable from `.env.example` as a Vercel project environment variable, and
run `npm run db:migrate:prod` before the first deploy. `SETTINGS_ENCRYPTION_KEY` must
differ per environment, and changing it makes the stored SMTP password unreadable —
re-enter it in the admin panel if you ever rotate it.
