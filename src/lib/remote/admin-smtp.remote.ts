import { command, form, query } from '$app/server';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import { smtpSettings } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
import { escapeHtml, loadSmtpSettings, sendTestEmail, SMTP_SINGLETON } from '#lib/server/mailer';
import { encryptSecret } from '#lib/server/secrets';
import { getAdminOverview } from './admin-dashboard.remote';
import { optionalText } from './schema';
import * as m from '#lib/paraglide/messages';

// The one admin screen that handles a secret. The SMTP password is stored
// encrypted (see src/lib/server/secrets.ts) and neither the cipher nor the
// plaintext ever crosses back to the browser: the query reports only whether a
// password is on file, and the form sends one only when the operator types a
// new one.

const DEFAULT_PORT = 587;

export type AdminSmtpSettings = Awaited<ReturnType<typeof getSmtpForAdmin>>;

/**
 * The stored SMTP row for the settings form. Columns are listed one by one
 * rather than spread out of the row, so `passwordCipher` - and any secret added
 * to this table later - cannot reach the browser by being forgotten about.
 */
export const getSmtpForAdmin = query(async () => {
	requireAdmin();

	const row = await loadSmtpSettings();

	return {
		enabled: row?.enabled ?? false,
		host: row?.host ?? '',
		port: row?.port ?? DEFAULT_PORT,
		secure: row?.secure ?? false,
		username: row?.username ?? '',
		fromName: row?.fromName ?? '',
		fromAddress: row?.fromAddress ?? '',
		toAddress: row?.toAddress ?? '',
		hasPassword: Boolean(row?.passwordCipher),
		// The test send reads the stored row rather than the form, so it can only
		// run once the settings have been saved - and only when they name a
		// server, a sender and a recipient.
		canTest: Boolean(row?.host && row.fromAddress && row.toAddress)
	};
});

const emailShape = v.pipe(v.string(), v.email());

/**
 * `v.email()` rejects an empty string, but both address fields are allowed to
 * stay blank until the operator has the details to hand.
 *
 * The message is a thunk because this schema is built when the module loads,
 * outside any request - see the same note in site.remote.ts.
 */
const emailOrBlank = (max = 180) =>
	v.pipe(
		optionalText(max),
		v.check(
			(value) => value === '' || v.safeParse(emailShape, value).success,
			() => m.contact_form_error_email()
		)
	);

const portInvalid = () => m.admin_smtp_port_invalid();

const smtpFormSchema = v.object({
	// An unchecked checkbox submits nothing at all, so both toggles have to be
	// optional with an explicit `false` default.
	enabled: v.optional(v.boolean(), false),
	host: optionalText(255),
	port: v.optional(
		v.pipe(
			v.number(portInvalid),
			v.integer(portInvalid),
			v.minValue(1, portInvalid),
			v.maxValue(65535, portInvalid)
		),
		DEFAULT_PORT
	),
	secure: v.optional(v.boolean(), false),
	username: optionalText(255),
	// Deliberately not trimmed: a password is opaque, and storing something
	// other than what the operator typed would fail at the worst moment.
	password: v.pipe(v.string(), v.maxLength(255)),
	fromName: optionalText(120),
	fromAddress: emailOrBlank(),
	toAddress: emailOrBlank()
});

export const saveSmtpSettings = form(smtpFormSchema, async (data) => {
	requireAdmin();

	const values = {
		enabled: data.enabled,
		host: data.host,
		port: data.port,
		secure: data.secure,
		username: data.username,
		fromName: data.fromName,
		fromAddress: data.fromAddress,
		toAddress: data.toAddress,
		// `$onUpdate` fires for `update()`, not for the update half of an upsert.
		updatedAt: new Date()
	};

	// A blank password field means "keep the one that is stored", so the cipher
	// column is only written when the operator actually typed a new password.
	const passwordCipher = data.password ? await encryptSecret(data.password) : null;

	await db
		.insert(smtpSettings)
		.values({ id: SMTP_SINGLETON, ...values, passwordCipher })
		.onConflictDoUpdate({
			target: smtpSettings.id,
			set: passwordCipher ? { ...values, passwordCipher } : values
		});

	await getSmtpForAdmin().refresh();
	// The dashboard card and the sidebar read the same settings.
	await getAdminOverview().refresh();

	return { ok: true as const };
});

export const sendSmtpTest = command(async () => {
	requireAdmin();

	const body = m.admin_smtp_test_body();

	const result = await sendTestEmail({
		subject: m.admin_smtp_test_subject(),
		text: body,
		html: `<p style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#001633">${escapeHtml(body)}</p>`
	});

	if (result.status === 'sent') return { ok: true as const };

	// `sendTestEmail` skips only a row it cannot send from, which is the case the
	// disabled test button already covers.
	const error = result.status === 'failed' ? result.error : m.admin_smtp_test_not_configured();

	return { ok: false as const, error };
});
