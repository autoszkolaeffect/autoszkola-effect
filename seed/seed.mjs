// Creates application accounts directly in the database.
//
// This app has no signup path - an account exists only because it was seeded.
//
//   npm run db:seed        -> dev database  (.env.dev)
//   npm run db:seed:prod   -> prod database (.env.prod)
//
// Accounts are read from seed/accounts.json, which is gitignored because it
// holds plaintext passwords. Copy seed/accounts.example.json to create it.
//
// Idempotent: an email that already exists is skipped, never overwritten, so
// re-running is safe and adding a new entry seeds only that entry.

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';

const ACCOUNTS_FILE = process.env.SEED_ACCOUNTS_FILE ?? 'seed/accounts.json';

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
		console.error(`${key} is not set. Run this via "npm run db:seed" or "npm run db:seed:prod".`);
		process.exit(1);
	}
}

if (!existsSync(ACCOUNTS_FILE)) {
	console.error(`${ACCOUNTS_FILE} not found.`);
	console.error(`Copy seed/accounts.example.json to ${ACCOUNTS_FILE} and fill it in.`);
	process.exit(1);
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

const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));

if (!Array.isArray(accounts) || accounts.length === 0) {
	console.error(`${ACCOUNTS_FILE} must be a non-empty JSON array.`);
	process.exit(1);
}

console.log(
	`Seeding ${accounts.length} account(s) into ${CLOUDFLARE_DATABASE_NAME ?? CLOUDFLARE_DATABASE_ID}\n`
);

let created = 0;
let skipped = 0;

for (const entry of accounts) {
	const email = String(entry.email ?? '')
		.trim()
		.toLowerCase();
	const password = String(entry.password ?? '');
	const name = String(entry.name ?? '').trim() || email.split('@')[0];

	if (!email || !password) {
		console.error(`  ! entry missing email or password - skipped`);
		skipped++;
		continue;
	}

	if ((await d1('SELECT id FROM user WHERE email = ?', [email])).length > 0) {
		console.log(`  = ${email} already exists - skipped`);
		skipped++;
		continue;
	}

	const userId = randomUUID();
	const now = Date.now();

	await d1(
		'INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[userId, name, email, entry.emailVerified === false ? 0 : 1, null, now, now]
	);

	try {
		// better-auth resolves an email+password login by finding an account row
		// whose provider_id is 'credential' and whose account_id is the user's id.
		await d1(
			'INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[randomUUID(), userId, 'credential', userId, await hashPassword(password), now, now]
		);
	} catch (error) {
		// D1's REST API has no cross-request transactions, so undo the user row
		// rather than leaving an account-less user that can never log in.
		await d1('DELETE FROM user WHERE id = ?', [userId]);
		throw error;
	}

	console.log(`  + ${email} created`);
	created++;
}

console.log(`\nDone: ${created} created, ${skipped} skipped.`);
