<script module lang="ts">
	// `render=explicit` suppresses Cloudflare's auto-render pass, which only runs
	// once, when the script first loads. A widget mounted by a later client-side
	// navigation would never be picked up by it, so we always render ourselves.
	const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

	type TurnstileOptions = {
		sitekey: string;
		theme: 'auto' | 'light' | 'dark';
		language: string;
		'response-field': boolean;
		callback: (token: string) => void;
		'expired-callback': () => void;
		'error-callback': () => void;
	};

	type TurnstileApi = {
		render(container: HTMLElement, options: TurnstileOptions): string | undefined;
		reset(widgetId: string): void;
		remove(widgetId: string): void;
	};

	/** The script hangs the API off `window` once it has loaded. */
	function turnstile(): TurnstileApi | undefined {
		return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
	}

	let loading: Promise<void> | undefined;

	/**
	 * Injects the script once, however many widgets ask for it.
	 *
	 * A rejected attempt is not cached. This is a single-page app, so the promise
	 * outlives the page that created it - holding on to a failure would mean one
	 * flaky network moment leaves the contact form without a captcha for the rest
	 * of the visit, and every later submission rejected by the server.
	 */
	function loadScript(): Promise<void> {
		loading ??= new Promise<void>((resolve, reject) => {
			if (turnstile()) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.src = SCRIPT_SRC;
			script.async = true;

			const fail = (error: Error) => {
				script.remove();
				reject(error);
			};

			script.onload = () => (turnstile() ? resolve() : fail(new Error('turnstile-missing')));
			script.onerror = () => fail(new Error('turnstile-blocked'));
			document.head.append(script);
		}).catch((error: unknown) => {
			loading = undefined;
			throw error;
		});

		return loading;
	}
</script>

<script lang="ts">
	import type { RemoteFormField } from '$app/server';
	import { TURNSTILE_SITE_KEY } from '$app/env/public';
	import * as m from '#lib/paraglide/messages';

	// The token travels as a field of the remote form, so the widget is handed
	// that field rather than writing an input of its own: a remote form rejects any
	// field it did not name itself.
	let { field }: { field: RemoteFormField<string> } = $props();

	let container: HTMLDivElement | undefined = $state();
	let status: 'loading' | 'ready' | 'unavailable' = $state('loading');
	let token = $state('');
	let widgetId: string | undefined;

	/**
	 * A token is single-use and expires after five minutes, so a submission the
	 * server rejected needs a fresh one before the visitor can try again.
	 */
	export function reset(): void {
		token = '';
		if (widgetId) turnstile()?.reset(widgetId);
	}

	$effect(() => {
		const node = container;
		if (!node || !TURNSTILE_SITE_KEY) {
			status = 'unavailable';
			return;
		}

		let active = true;

		loadScript()
			.then(() => {
				if (!active) return;

				widgetId = turnstile()?.render(node, {
					sitekey: TURNSTILE_SITE_KEY,
					theme: 'dark',
					language: 'pl',
					// The hidden input below carries the token instead, so the field is
					// present - and named the way the form expects - even when the
					// script never loads.
					'response-field': false,
					callback: (value) => (token = value),
					'expired-callback': () => (token = ''),
					'error-callback': () => (token = '')
				});

				status = widgetId ? 'ready' : 'unavailable';
			})
			.catch(() => {
				// A blocked script must not take the form down with it: the server
				// verifies the token again, and rejects an empty one.
				if (active) status = 'unavailable';
			});

		return () => {
			active = false;
			if (widgetId) turnstile()?.remove(widgetId);
			widgetId = undefined;
			status = 'loading';
		};
	});
</script>

<div>
	<div bind:this={container}></div>

	{#if status === 'loading'}
		<p class="text-[0.8rem] text-paper/50">{m.contact_form_captcha_loading()}</p>
	{/if}

	<input {...field.as('hidden', token)} />
</div>
