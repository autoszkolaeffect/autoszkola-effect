import nodemailer, { type Transporter } from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { smtpSettings } from '#lib/server/db/schema';
import { decryptSecret } from '#lib/server/secrets';

export const SMTP_SINGLETON = 'singleton';

export type SmtpSettings = typeof smtpSettings.$inferSelect;

/** The stored SMTP row, or `undefined` if the admin has never saved one. */
export async function loadSmtpSettings(): Promise<SmtpSettings | undefined> {
	const [row] = await db
		.select()
		.from(smtpSettings)
		.where(eq(smtpSettings.id, SMTP_SINGLETON))
		.limit(1);

	return row;
}

function isUsable(settings: SmtpSettings | undefined): settings is SmtpSettings {
	return Boolean(settings?.enabled && settings.host && settings.fromAddress && settings.toAddress);
}

async function createTransport(settings: SmtpSettings): Promise<Transporter> {
	const password = await decryptSecret(settings.passwordCipher);

	return nodemailer.createTransport({
		host: settings.host,
		port: settings.port,
		// `secure: true` means implicit TLS from the first byte (port 465).
		// Otherwise nodemailer negotiates STARTTLS, which `requireTLS` makes
		// mandatory rather than best-effort - a plaintext fallback would leak the
		// password.
		secure: settings.secure,
		requireTLS: !settings.secure,
		auth: settings.username ? { user: settings.username, pass: password ?? '' } : undefined
	});
}

export type SendResult =
	{ status: 'sent' } | { status: 'skipped' } | { status: 'failed'; error: string };

type Mail = {
	subject: string;
	text: string;
	html: string;
	/** Where a reply should go - the visitor's address for a contact message. */
	replyTo?: string;
	/** Overrides the configured notification recipient. Used by the test send. */
	to?: string;
};

/**
 * Sends a notification through the configured SMTP server.
 *
 * Never throws: a mail failure must not lose the visitor's message, so the
 * caller records the outcome against the stored row and still reports success
 * to the visitor.
 */
export async function sendNotification(mail: Mail): Promise<SendResult> {
	let settings: SmtpSettings | undefined;

	try {
		settings = await loadSmtpSettings();
	} catch (error) {
		return { status: 'failed', error: describe(error) };
	}

	if (!isUsable(settings)) return { status: 'skipped' };

	try {
		const transport = await createTransport(settings);

		await transport.sendMail({
			from: settings.fromName
				? { name: settings.fromName, address: settings.fromAddress }
				: settings.fromAddress,
			to: mail.to ?? settings.toAddress,
			replyTo: mail.replyTo,
			subject: mail.subject,
			text: mail.text,
			html: mail.html
		});

		return { status: 'sent' };
	} catch (error) {
		return { status: 'failed', error: describe(error) };
	}
}

/**
 * Sends a test message using the settings as they are about to be saved, so the
 * admin can confirm the credentials before committing them. Unlike
 * {@link sendNotification} this reports the failure reason to the caller.
 */
export async function sendTestEmail(mail: Mail): Promise<SendResult> {
	const settings = await loadSmtpSettings();

	if (!settings?.host || !settings.fromAddress || !settings.toAddress) {
		return { status: 'failed', error: 'SMTP is not configured yet.' };
	}

	try {
		const transport = await createTransport({ ...settings, enabled: true });

		await transport.sendMail({
			from: settings.fromName
				? { name: settings.fromName, address: settings.fromAddress }
				: settings.fromAddress,
			to: mail.to ?? settings.toAddress,
			subject: mail.subject,
			text: mail.text,
			html: mail.html
		});

		return { status: 'sent' };
	} catch (error) {
		return { status: 'failed', error: describe(error) };
	}
}

function describe(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

/** Escapes a value for interpolation into the HTML body of a notification. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
