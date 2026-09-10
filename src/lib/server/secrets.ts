import { SETTINGS_ENCRYPTION_KEY } from '$app/env/private';

// AES-256-GCM via WebCrypto, so this works unchanged on the Node runtime and on
// any edge runtime we might move to later.
//
// Stored form is `v1.<iv>.<ciphertext+tag>`, both base64url. The version prefix
// is there so a future key rotation or algorithm change can recognise - rather
// than misread - values written today.

const VERSION = 'v1';
const IV_BYTES = 12;

let cachedKey: Promise<CryptoKey> | undefined;

function importKey(): Promise<CryptoKey> {
	const raw = Buffer.from(SETTINGS_ENCRYPTION_KEY, 'base64url');

	if (raw.byteLength !== 32) {
		throw new Error(
			`SETTINGS_ENCRYPTION_KEY must decode to 32 bytes, got ${raw.byteLength}. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
		);
	}

	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function key(): Promise<CryptoKey> {
	return (cachedKey ??= importKey());
}

const toBase64Url = (bytes: ArrayBuffer | Uint8Array) =>
	Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');

/** Encrypts a secret for storage in the database. */
export async function encryptSecret(plaintext: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await key(),
		new TextEncoder().encode(plaintext)
	);

	return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

/**
 * Decrypts a value written by {@link encryptSecret}. Returns `undefined` for a
 * missing value, and throws for one that is present but unreadable - which
 * almost always means `SETTINGS_ENCRYPTION_KEY` changed, and the operator needs
 * to know rather than silently send mail without a password.
 */
export async function decryptSecret(
	stored: string | null | undefined
): Promise<string | undefined> {
	if (!stored) return undefined;

	const [version, ivPart, dataPart] = stored.split('.');

	if (version !== VERSION || !ivPart || !dataPart) {
		throw new Error('Stored secret is not in the expected format.');
	}

	try {
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: Buffer.from(ivPart, 'base64url') },
			await key(),
			Buffer.from(dataPart, 'base64url')
		);

		return new TextDecoder().decode(plaintext);
	} catch {
		throw new Error(
			'Stored secret could not be decrypted. SETTINGS_ENCRYPTION_KEY has most likely changed - re-enter the SMTP password in the admin panel.'
		);
	}
}
