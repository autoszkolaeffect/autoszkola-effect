import { relations, sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export * from './auth.schema';

// Every piece of editable content is split in two: a base row holding the
// locale-independent facts (ordering, photo, dates, status) and one translation
// row per locale holding the words. Adding a locale to `project.inlang/settings.json`
// therefore never needs a migration - `src/lib/locales.ts` fills in the missing
// translation rows for the new locale on demand.
//
// Translation tables all follow the same shape: a cascading parent reference, a
// `locale` column, and a unique index over the pair.

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull();

const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull();

/* ------------------------------------------------------------------ instructors */

export const instructor = sqliteTable('instructor', {
	id: id(),
	sortOrder: integer('sort_order').notNull().default(0),
	// A `data:image/...;base64,...` URL. The admin panel downscales before upload -
	// see `MAX_PHOTO_BYTES` in src/lib/remote/admin-instructors.remote.ts - because
	// a D1 row cannot exceed 1 MB.
	photo: text('photo'),
	// A `#rrggbb` colour picked in the admin panel. NULL means automatic: the card
	// falls back to the positional cycle - see `instructorAccentHex` in
	// src/lib/accents.ts. Unlike `blog_category.accent`, which is an enum limited to
	// the four palette names, this is free-form, because the picker offers any colour.
	accent: text('accent'),
	published: integer('published', { mode: 'boolean' }).notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const instructorTranslation = sqliteTable(
	'instructor_translation',
	{
		id: id(),
		instructorId: text('instructor_id')
			.notNull()
			.references(() => instructor.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		name: text('name').notNull().default(''),
		// The badge over the photo, e.g. "Instruktor kat. B i B+E".
		badge: text('badge').notNull().default(''),
		// The gold line under the name, e.g. "14 lat doświadczenia".
		experience: text('experience').notNull().default(''),
		bio: text('bio').notNull().default('')
	},
	(table) => [
		unique('instructor_translation_locale_unq').on(table.instructorId, table.locale),
		index('instructor_translation_locale_idx').on(table.locale)
	]
);

/* ------------------------------------------------------------------------- blog */

export const blogCategory = sqliteTable('blog_category', {
	id: id(),
	// Stable machine name, used in URLs and never translated.
	slug: text('slug').notNull().unique(),
	// Which accent the badge and the card's top rule take. Constrained in the
	// admin UI to the palette in docs/DESIGN.md.
	accent: text('accent', { enum: ['red', 'yellow', 'blue', 'orange'] })
		.notNull()
		.default('red'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const blogCategoryTranslation = sqliteTable(
	'blog_category_translation',
	{
		id: id(),
		categoryId: text('category_id')
			.notNull()
			.references(() => blogCategory.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		label: text('label').notNull().default('')
	},
	(table) => [unique('blog_category_translation_locale_unq').on(table.categoryId, table.locale)]
);

export const blogPost = sqliteTable(
	'blog_post',
	{
		id: id(),
		categoryId: text('category_id').references(() => blogCategory.id, { onDelete: 'set null' }),
		status: text('status', { enum: ['draft', 'published'] })
			.notNull()
			.default('draft'),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
		readingMinutes: integer('reading_minutes').notNull().default(1),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('blog_post_published_idx').on(table.status, table.publishedAt)]
);

export const blogPostTranslation = sqliteTable(
	'blog_post_translation',
	{
		id: id(),
		postId: text('post_id')
			.notNull()
			.references(() => blogPost.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		// Per-locale so a future locale can have its own readable URL. Nullable
		// rather than defaulted to '': SQLite's UNIQUE tolerates many NULLs but
		// only one '', and unpublished drafts legitimately have no slug yet.
		slug: text('slug'),
		title: text('title').notNull().default(''),
		// Rendered as the italic lead paragraph above the article body.
		excerpt: text('excerpt').notNull().default(''),
		// Markdown. Raw HTML is not honoured when rendering - see src/lib/markdown.ts.
		body: text('body').notNull().default('')
	},
	(table) => [
		unique('blog_post_translation_locale_unq').on(table.postId, table.locale),
		// A slug only has to be unique within its locale, and only when set.
		unique('blog_post_translation_slug_unq').on(table.locale, table.slug)
	]
);

/* --------------------------------------------------------------------- opinions */

export const opinion = sqliteTable('opinion', {
	id: id(),
	sortOrder: integer('sort_order').notNull().default(0),
	// Real rather than integer: a rating is 0-5 in half-star steps, so 4.5 has to survive.
	rating: real('rating').notNull().default(5),
	published: integer('published', { mode: 'boolean' }).notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const opinionTranslation = sqliteTable(
	'opinion_translation',
	{
		id: id(),
		opinionId: text('opinion_id')
			.notNull()
			.references(() => opinion.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		author: text('author').notNull().default(''),
		quote: text('quote').notNull().default('')
	},
	(table) => [unique('opinion_translation_locale_unq').on(table.opinionId, table.locale)]
);

/* ---------------------------------------------------------------------- contact */

// Single row, id `singleton`. Everything the "Kontakt" tab and the footer show
// that is not a phone number or a course option.
export const contactSettings = sqliteTable('contact_settings', {
	id: text('id').primaryKey().default('singleton'),
	email: text('email').notNull().default(''),
	// What the embedded map points at. Free text - an address, a place name or
	// "lat,lng" - URL-encoded into a Google Maps embed, so no API key is needed.
	mapQuery: text('map_query').notNull().default(''),
	// Optional escape hatch: a full `https://www.google.com/maps/embed?pb=...` URL
	// pasted from Google Maps' own "Share -> Embed a map". Wins over `mapQuery`.
	mapEmbedUrl: text('map_embed_url'),
	updatedAt: updatedAt()
});

export const contactSettingsTranslation = sqliteTable('contact_settings_translation', {
	id: id(),
	locale: text('locale').notNull().unique(),
	pageTitle: text('page_title').notNull().default(''),
	pageIntro: text('page_intro').notNull().default(''),
	phonesHeading: text('phones_heading').notNull().default(''),
	addressHeading: text('address_heading').notNull().default(''),
	formHeading: text('form_heading').notNull().default(''),
	companyName: text('company_name').notNull().default(''),
	addressLine1: text('address_line1').notNull().default(''),
	addressLine2: text('address_line2').notNull().default(''),
	openingHours: text('opening_hours').notNull().default(''),
	// The one-line address shown in the footer, which is shorter than the
	// two lines shown on the contact page.
	footerAddress: text('footer_address').notNull().default('')
});

export const contactPhone = sqliteTable('contact_phone', {
	id: id(),
	sortOrder: integer('sort_order').notNull().default(0),
	number: text('number').notNull().default(''),
	// The first phone with this set is the one in the navigation bar's yellow button.
	primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false)
});

export const contactPhoneTranslation = sqliteTable(
	'contact_phone_translation',
	{
		id: id(),
		phoneId: text('phone_id')
			.notNull()
			.references(() => contactPhone.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		// e.g. "TELEFON", "BIURO"
		label: text('label').notNull().default('')
	},
	(table) => [unique('contact_phone_translation_locale_unq').on(table.phoneId, table.locale)]
);

// The "Interesuje mnie kurs" dropdown.
export const courseOption = sqliteTable('course_option', {
	id: id(),
	sortOrder: integer('sort_order').notNull().default(0),
	// Stored verbatim on the message, so it stays meaningful after a label edit.
	value: text('value').notNull().unique()
});

export const courseOptionTranslation = sqliteTable(
	'course_option_translation',
	{
		id: id(),
		courseOptionId: text('course_option_id')
			.notNull()
			.references(() => courseOption.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull(),
		label: text('label').notNull().default('')
	},
	(table) => [unique('course_option_translation_locale_unq').on(table.courseOptionId, table.locale)]
);

/* --------------------------------------------------------------------- messages */

export const contactMessage = sqliteTable(
	'contact_message',
	{
		id: id(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		phone: text('phone'),
		course: text('course'),
		message: text('message').notNull(),
		// Which locale of the site the message was sent from.
		locale: text('locale').notNull(),
		createdAt: createdAt(),
		readAt: integer('read_at', { mode: 'timestamp_ms' }),
		archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		// Whether the nodemailer notification went out. `skipped` means SMTP was
		// not configured or disabled - the message itself is still stored.
		notificationStatus: text('notification_status', {
			enum: ['pending', 'sent', 'failed', 'skipped']
		})
			.notNull()
			.default('pending'),
		notificationError: text('notification_error'),
		notificationSentAt: integer('notification_sent_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('contact_message_created_idx').on(table.createdAt),
		index('contact_message_unread_idx').on(table.readAt)
	]
);

/* ------------------------------------------------------------------------- smtp */

// Single row, id `singleton`.
export const smtpSettings = sqliteTable('smtp_settings', {
	id: text('id').primaryKey().default('singleton'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	host: text('host').notNull().default(''),
	port: integer('port').notNull().default(587),
	// Implicit TLS (port 465). Port 587 upgrades with STARTTLS instead.
	secure: integer('secure', { mode: 'boolean' }).notNull().default(false),
	username: text('username').notNull().default(''),
	// AES-256-GCM, keyed by SETTINGS_ENCRYPTION_KEY. Never leaves the server.
	// See src/lib/server/secrets.ts.
	passwordCipher: text('password_cipher'),
	fromName: text('from_name').notNull().default(''),
	fromAddress: text('from_address').notNull().default(''),
	// Where contact form notifications are delivered.
	toAddress: text('to_address').notNull().default(''),
	updatedAt: updatedAt()
});

/* ---------------------------------------------------------------------- relations */

export const instructorRelations = relations(instructor, ({ many }) => ({
	translations: many(instructorTranslation)
}));

export const instructorTranslationRelations = relations(instructorTranslation, ({ one }) => ({
	instructor: one(instructor, {
		fields: [instructorTranslation.instructorId],
		references: [instructor.id]
	})
}));

export const blogCategoryRelations = relations(blogCategory, ({ many }) => ({
	translations: many(blogCategoryTranslation),
	posts: many(blogPost)
}));

export const blogCategoryTranslationRelations = relations(blogCategoryTranslation, ({ one }) => ({
	category: one(blogCategory, {
		fields: [blogCategoryTranslation.categoryId],
		references: [blogCategory.id]
	})
}));

export const blogPostRelations = relations(blogPost, ({ one, many }) => ({
	category: one(blogCategory, {
		fields: [blogPost.categoryId],
		references: [blogCategory.id]
	}),
	translations: many(blogPostTranslation)
}));

export const blogPostTranslationRelations = relations(blogPostTranslation, ({ one }) => ({
	post: one(blogPost, {
		fields: [blogPostTranslation.postId],
		references: [blogPost.id]
	})
}));

export const opinionRelations = relations(opinion, ({ many }) => ({
	translations: many(opinionTranslation)
}));

export const opinionTranslationRelations = relations(opinionTranslation, ({ one }) => ({
	opinion: one(opinion, {
		fields: [opinionTranslation.opinionId],
		references: [opinion.id]
	})
}));

export const contactPhoneRelations = relations(contactPhone, ({ many }) => ({
	translations: many(contactPhoneTranslation)
}));

export const contactPhoneTranslationRelations = relations(contactPhoneTranslation, ({ one }) => ({
	phone: one(contactPhone, {
		fields: [contactPhoneTranslation.phoneId],
		references: [contactPhone.id]
	})
}));

export const courseOptionRelations = relations(courseOption, ({ many }) => ({
	translations: many(courseOptionTranslation)
}));

export const courseOptionTranslationRelations = relations(courseOptionTranslation, ({ one }) => ({
	courseOption: one(courseOption, {
		fields: [courseOptionTranslation.courseOptionId],
		references: [courseOption.id]
	})
}));
