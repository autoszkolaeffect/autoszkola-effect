// Seeds the site's editable content: instructors, opinions, blog categories and
// posts, contact details and the contact form's course options.
//
//   npm run db:seed:content        -> dev database  (.env.dev)
//   npm run db:seed:content:prod   -> prod database (.env.prod)
//
// This is the content from the original design, so a freshly migrated database
// renders the site exactly as designed. Everything it writes is editable in the
// admin panel afterwards.
//
// Idempotent per record: a row whose natural key already exists is left alone,
// never overwritten, so re-running after an edit in the admin panel is safe and
// adding one new post to seed/content/blog seeds only that post.
//
// Locales come from project.inlang/settings.json. Content is written for the
// base locale; the admin panel fills in the rest.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const {
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_DATABASE_ID,
	CLOUDFLARE_D1_TOKEN,
	CLOUDFLARE_DATABASE_NAME
} = process.env;

for (const [key, value] of Object.entries({
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_DATABASE_ID,
	CLOUDFLARE_D1_TOKEN
})) {
	if (!value) {
		console.error(`${key} is not set. Run this via "npm run db:seed:content".`);
		process.exit(1);
	}
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

async function d1(sql, params = []) {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${CLOUDFLARE_D1_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ sql, params })
	});

	const body = await response.json().catch(() => null);

	if (!response.ok || !body?.success) {
		throw new Error(
			`D1 query failed (HTTP ${response.status}): ${JSON.stringify(body?.errors ?? body)}`
		);
	}

	return body.result[0].results ?? [];
}

const baseLocale = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8')).baseLocale;
const now = () => Date.now();

/** Minimal front-matter reader: `key: value` pairs, optionally quoted. */
function parseFrontMatter(source) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
	if (!match) return { data: {}, body: source.trim() };

	const data = {};

	for (const line of match[1].split(/\r?\n/)) {
		const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
		if (!pair) continue;

		let value = pair[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		data[pair[1]] = value;
	}

	return { data, body: source.slice(match[0].length).trim() };
}

let created = 0;
let skipped = 0;

const note = (symbol, text) => console.log(`  ${symbol} ${text}`);

/* --------------------------------------------------------------------- contact */

async function seedContact() {
	const existing = await d1('SELECT id FROM contact_settings WHERE id = ?', ['singleton']);

	if (existing.length === 0) {
		await d1(
			'INSERT INTO contact_settings (id, email, map_query, updated_at) VALUES (?, ?, ?, ?)',
			['singleton', 'kontakt@efekt-szkola.pl', 'Al. Kardynała Stefana Wyszyńskiego 97, Łódź', now()]
		);
		note('+', 'contact settings');
		created++;
	} else {
		note('=', 'contact settings already exist');
		skipped++;
	}

	const translation = await d1('SELECT id FROM contact_settings_translation WHERE locale = ?', [
		baseLocale
	]);

	if (translation.length === 0) {
		await d1(
			`INSERT INTO contact_settings_translation
			 (id, locale, page_title, page_intro, phones_heading, address_heading, form_heading,
			  company_name, address_line1, address_line2, opening_hours, footer_address)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				randomUUID(),
				baseLocale,
				'Kontakt',
				'Zapraszamy do kontaktu - zapiszemy Cię na kurs, odpowiemy na pytania i pomożemy wybrać odpowiedni termin.',
				'Telefony',
				'Adres',
				'Formularz kontaktowy',
				'Auto Szkoła Efekt',
				'Al. Kardynała Stefana Wyszyńskiego 97/83',
				'Łódź',
				'Pon–Pt: 8:00–18:00 · Sob: 9:00–14:00',
				'Al. Kard. S. Wyszyńskiego 97/83, Łódź'
			]
		);
		note('+', `contact settings text (${baseLocale})`);
		created++;
	} else {
		skipped++;
	}

	const phones = [{ label: 'Telefon', number: '660 710 448', primary: 1 }];

	for (const [index, phone] of phones.entries()) {
		const found = await d1('SELECT id FROM contact_phone WHERE number = ?', [phone.number]);

		if (found.length > 0) {
			skipped++;
			continue;
		}

		const phoneId = randomUUID();
		await d1('INSERT INTO contact_phone (id, sort_order, number, is_primary) VALUES (?, ?, ?, ?)', [
			phoneId,
			index,
			phone.number,
			phone.primary
		]);
		await d1(
			'INSERT INTO contact_phone_translation (id, phone_id, locale, label) VALUES (?, ?, ?, ?)',
			[randomUUID(), phoneId, baseLocale, phone.label]
		);
		note('+', `phone ${phone.number}`);
		created++;
	}

	const courses = ['Kategoria B', 'Kategoria B+E', 'Kurs doszkalający', 'Inny'];

	for (const [index, label] of courses.entries()) {
		const found = await d1('SELECT id FROM course_option WHERE value = ?', [label]);

		if (found.length > 0) {
			skipped++;
			continue;
		}

		const optionId = randomUUID();
		// `value` doubles as the stable identifier stored on each message.
		await d1('INSERT INTO course_option (id, sort_order, value) VALUES (?, ?, ?)', [
			optionId,
			index,
			label
		]);
		await d1(
			'INSERT INTO course_option_translation (id, course_option_id, locale, label) VALUES (?, ?, ?, ?)',
			[randomUUID(), optionId, baseLocale, label]
		);
		note('+', `course option "${label}"`);
		created++;
	}
}

/* ----------------------------------------------------------------- instructors */

const INSTRUCTORS = [
	{
		file: 'marek-kowalski.jpg',
		name: 'Marek Kowalski',
		badge: 'Instruktor kat. B',
		experience: '14 lat doświadczenia',
		bio: 'Certyfikowany instruktor nauki jazdy z 14-letnim stażem. Specjalista od techniki defensywnej i bezpiecznej jazdy w warunkach miejskich. Przeprowadził ponad 1200 kursantów przez egzamin państwowy.'
	},
	{
		file: 'anna-wisniewska.jpg',
		name: 'Anna Wiśniewska',
		badge: 'Instruktor kat. B i BE',
		experience: '9 lat doświadczenia',
		bio: 'Pasjonatka bezpiecznej jazdy z 9-letnim doświadczeniem. Znana z cierpliwości i skutecznych metod pracy z kursantami pierwszorazowymi. Zdawalność jej kursantów wynosi 78%.'
	},
	{
		file: 'piotr-nowak.jpg',
		name: 'Piotr Nowak',
		badge: 'Instruktor kat. B',
		experience: '11 lat doświadczenia',
		bio: 'Były funkcjonariusz policji drogowej - perfekcjonista w zakresie przepisów ruchu drogowego. Przygotowuje kursantów gruntownie zarówno do teorii, jak i egzaminu praktycznego.'
	},
	{
		file: 'katarzyna-jablonska.jpg',
		name: 'Katarzyna Jabłońska',
		badge: 'Instruktor kat. B',
		experience: '6 lat doświadczenia',
		bio: 'Młoda, energiczna instruktorka z dyplomem psychologii transportu. Stosuje nowoczesne metody dydaktyczne i indywidualnie dopasowuje tempo nauki do każdego kursanta.'
	},
	{
		file: 'tomasz-zielinski.jpg',
		name: 'Tomasz Zieliński',
		badge: 'Instruktor kat. B i B+E',
		experience: '18 lat doświadczenia',
		bio: 'Nestor naszego zespołu z 18-letnim stażem. Wychował kilka pokoleń kierowców w Łodzi. Specjalizuje się w nauce jazdy z przyczepą oraz w zaawansowanej technice jazdy.'
	}
];

async function seedInstructors() {
	for (const [index, person] of INSTRUCTORS.entries()) {
		const found = await d1('SELECT id FROM instructor_translation WHERE locale = ? AND name = ?', [
			baseLocale,
			person.name
		]);

		if (found.length > 0) {
			skipped++;
			continue;
		}

		const path = join('seed', 'content', 'instructors', person.file);
		let photo = null;

		if (existsSync(path)) {
			photo = `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`;
		} else {
			note('!', `${person.name}: ${path} not found, seeding without a photo`);
		}

		const instructorId = randomUUID();
		const timestamp = now();

		await d1(
			'INSERT INTO instructor (id, sort_order, photo, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
			[instructorId, index, photo, 1, timestamp, timestamp]
		);
		await d1(
			'INSERT INTO instructor_translation (id, instructor_id, locale, name, badge, experience, bio) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[
				randomUUID(),
				instructorId,
				baseLocale,
				person.name,
				person.badge,
				person.experience,
				person.bio
			]
		);

		note('+', `instructor ${person.name}`);
		created++;
	}
}

/* -------------------------------------------------------------------- opinions */

const OPINIONS = [
	{
		author: 'Marta K.',
		quote:
			'Zdałam za pierwszym razem! Pan Marek tłumaczył wszystko tak spokojnie i konkretnie. Polecam każdemu, kto boi się egzaminu.'
	},
	{
		author: 'Damian R.',
		quote:
			'Świetna szkoła, profesjonalne podejście. Teoria online i elastyczne godziny jazd to ogromny plus. Zdałem po 3 miesiącach.'
	},
	{
		author: 'Zofia M.',
		quote:
			'Pani Anna była niesamowicie cierpliwa. Bałam się jazdy, ale po kursie czuję się pewnie za kierownicą. Szczerze polecam!'
	},
	{
		author: 'Kamil T.',
		quote:
			'Bardzo dobre przygotowanie do WORD. Instruktorzy znają na pamięć ulubione miejsca egzaminatorów. Zdałem bez problemów.'
	}
];

async function seedOpinions() {
	for (const [index, entry] of OPINIONS.entries()) {
		const found = await d1('SELECT id FROM opinion_translation WHERE locale = ? AND author = ?', [
			baseLocale,
			entry.author
		]);

		if (found.length > 0) {
			skipped++;
			continue;
		}

		const opinionId = randomUUID();
		const timestamp = now();

		await d1(
			'INSERT INTO opinion (id, sort_order, rating, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
			[opinionId, index, 5, 1, timestamp, timestamp]
		);
		await d1(
			'INSERT INTO opinion_translation (id, opinion_id, locale, author, quote) VALUES (?, ?, ?, ?, ?)',
			[randomUUID(), opinionId, baseLocale, entry.author, entry.quote]
		);

		note('+', `opinion by ${entry.author}`);
		created++;
	}
}

/* ------------------------------------------------------------------------ blog */

const CATEGORIES = [
	{ slug: 'praktyczny', accent: 'red', label: 'Egzamin praktyczny' },
	{ slug: 'teoretyczny', accent: 'yellow', label: 'Egzamin teoretyczny' }
];

async function seedBlog() {
	/** @type {Record<string, string>} */
	const categoryIds = {};

	for (const [index, category] of CATEGORIES.entries()) {
		const found = await d1('SELECT id FROM blog_category WHERE slug = ?', [category.slug]);

		if (found.length > 0) {
			categoryIds[category.slug] = found[0].id;
			skipped++;
			continue;
		}

		const categoryId = randomUUID();
		const timestamp = now();

		await d1(
			'INSERT INTO blog_category (id, slug, accent, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
			[categoryId, category.slug, category.accent, index, timestamp, timestamp]
		);
		await d1(
			'INSERT INTO blog_category_translation (id, category_id, locale, label) VALUES (?, ?, ?, ?)',
			[randomUUID(), categoryId, baseLocale, category.label]
		);

		categoryIds[category.slug] = categoryId;
		note('+', `category ${category.label}`);
		created++;
	}

	const dir = join('seed', 'content', 'blog', baseLocale);

	if (!existsSync(dir)) {
		note('!', `${dir} not found, no posts seeded`);
		return;
	}

	const files = readdirSync(dir)
		.filter((name) => name.endsWith('.md'))
		.sort();

	for (const file of files) {
		const { data, body } = parseFrontMatter(readFileSync(join(dir, file), 'utf8'));
		const slug = data.slug || file.replace(/\.md$/, '');

		const found = await d1('SELECT id FROM blog_post_translation WHERE locale = ? AND slug = ?', [
			baseLocale,
			slug
		]);

		if (found.length > 0) {
			skipped++;
			continue;
		}

		const postId = randomUUID();
		const timestamp = now();
		const publishedAt = data.publishedAt ? Date.parse(`${data.publishedAt}T09:00:00Z`) : timestamp;

		await d1(
			`INSERT INTO blog_post
			 (id, category_id, status, published_at, reading_minutes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				postId,
				categoryIds[data.category] ?? null,
				'published',
				publishedAt,
				Number(data.readingMinutes) || 1,
				timestamp,
				timestamp
			]
		);

		await d1(
			`INSERT INTO blog_post_translation (id, post_id, locale, slug, title, excerpt, body)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[randomUUID(), postId, baseLocale, slug, data.title ?? slug, data.excerpt ?? '', body]
		);

		note('+', `post ${slug}`);
		created++;
	}
}

/* ------------------------------------------------------------------------- run */

console.log(`Seeding content into ${CLOUDFLARE_DATABASE_NAME ?? CLOUDFLARE_DATABASE_ID}\n`);

await seedContact();
await seedInstructors();
await seedOpinions();
await seedBlog();

console.log(`\nDone: ${created} created, ${skipped} skipped.`);
