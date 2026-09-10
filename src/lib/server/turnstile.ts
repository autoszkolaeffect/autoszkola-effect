import { TURNSTILE_SECRET_KEY } from '$app/env/private';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type SiteVerifyResponse = {
	success: boolean;
	'error-codes'?: string[];
	challenge_ts?: string;
	hostname?: string;
};

/**
 * Verifies a Turnstile token against Cloudflare.
 *
 * A token is single-use and expires after five minutes, so this must be called
 * once per submission, server-side, before anything is written.
 *
 * Returns `false` rather than throwing on a network failure: a Cloudflare
 * outage should read as "not verified" at the call site, which decides what to
 * tell the visitor.
 */
export async function verifyTurnstile(
	token: string | undefined | null,
	remoteIp?: string | null
): Promise<{ ok: boolean; errors: string[] }> {
	if (!token) return { ok: false, errors: ['missing-input-response'] };

	const body = new FormData();
	body.set('secret', TURNSTILE_SECRET_KEY);
	body.set('response', token);
	if (remoteIp) body.set('remoteip', remoteIp);

	try {
		const response = await fetch(VERIFY_URL, { method: 'POST', body });

		if (!response.ok) {
			return { ok: false, errors: [`http-${response.status}`] };
		}

		const result = (await response.json()) as SiteVerifyResponse;

		return { ok: result.success === true, errors: result['error-codes'] ?? [] };
	} catch (error) {
		return { ok: false, errors: [error instanceof Error ? error.message : 'network-error'] };
	}
}
