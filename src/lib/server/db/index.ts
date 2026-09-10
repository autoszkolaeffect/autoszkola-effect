import { drizzle } from 'drizzle-orm/sqlite-proxy';
import {
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_DATABASE_ID,
	CLOUDFLARE_D1_TOKEN
} from '$app/env/private';
import * as schema from './schema';

// D1 bindings only exist inside Cloudflare Workers. This app is hosted on
// Vercel, so we reach D1 over its REST API and drive drizzle through
// sqlite-proxy instead of drizzle-orm/d1 (which requires a binding object).
//
// The /raw endpoint is required rather than /query: sqlite-proxy indexes each
// row positionally (row[columnIndex]), and /raw returns rows as arrays in
// column order while /query returns objects.
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/raw`;

async function query(sql: string, params: unknown[], method: 'run' | 'all' | 'values' | 'get') {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${CLOUDFLARE_D1_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ sql, params })
	});

	if (!response.ok) {
		throw new Error(`D1 request failed: ${response.status} ${response.statusText}`);
	}

	const body = await response.json();

	if (!body.success) {
		throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`);
	}

	const rows = body.result?.[0]?.results?.rows ?? [];

	// `get` hands its value straight to drizzle's row mapper, so it must be the
	// single row itself - and undefined, never [], when nothing matched.
	if (method === 'get') return { rows: rows[0] };

	return { rows };
}

export const db = drizzle(query, { schema });
