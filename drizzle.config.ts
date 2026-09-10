import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';

// Defaults to the dev database. To target prod, provide the variables from the
// environment instead of this file:
//   node --env-file=.env.prod node_modules/drizzle-kit/bin.cjs migrate
const envFile = process.env.ENV_FILE ?? '.env.dev';
if (!process.env.CLOUDFLARE_DATABASE_ID && existsSync(envFile)) {
	process.loadEnvFile(envFile);
}

const where = `Set it in ${envFile} - see .env.example for where to find it.`;

if (!process.env.CLOUDFLARE_ACCOUNT_ID)
	throw new Error(`CLOUDFLARE_ACCOUNT_ID is not set. ${where}`);
if (!process.env.CLOUDFLARE_DATABASE_ID)
	throw new Error(`CLOUDFLARE_DATABASE_ID is not set. ${where}`);
if (!process.env.CLOUDFLARE_D1_TOKEN) throw new Error(`CLOUDFLARE_D1_TOKEN is not set. ${where}`);

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID,
		token: process.env.CLOUDFLARE_D1_TOKEN
	},
	verbose: true,
	strict: true
});
