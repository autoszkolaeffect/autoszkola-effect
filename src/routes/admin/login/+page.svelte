<script lang="ts">
	import { enhance } from '$app/forms';
	import { pageTitle } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';
	import logo from '#lib/assets/efekt-logo.jpg';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let pending = $state(false);
	let passwordVisible = $state(false);
</script>

<svelte:head>
	<title>{pageTitle(m.admin_login_title())}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-6 py-16">
	<div class="w-full max-w-100">
		<!-- Source is 2048x607; 162x48 preserves that ratio so the card does not
		     shift while the image loads. -->
		<img
			src={logo}
			alt={m.logo_alt()}
			class="mx-auto mb-8 block h-12 w-auto"
			width="162"
			height="48"
		/>

		<div class="border-t-3 border-yellow bg-blue p-8">
			<h1 class="text-login font-bold text-yellow">{m.admin_login_title()}</h1>
			<p class="mt-2 mb-7 text-label leading-card text-paper/70">{m.admin_login_intro()}</p>

			{#if form?.error}
				<p
					class="mb-6 border-l-3 border-red bg-red/20 px-4 py-3 text-caption leading-normal text-paper"
					role="alert"
				>
					{form.error}
				</p>
			{/if}

			<form
				method="POST"
				action="?/login"
				class="flex flex-col gap-5"
				use:enhance={() => {
					pending = true;

					return async ({ update }) => {
						await update();
						pending = false;
					};
				}}
			>
				<input type="hidden" name="redirectTo" value={data.redirectTo} />

				<div class="flex flex-col gap-2">
					<label class="eyebrow text-eyebrow text-paper/60" for="admin-login-email">
						{m.admin_login_email()}
					</label>
					<input
						id="admin-login-email"
						class="field"
						type="email"
						name="email"
						value={form?.email ?? ''}
						autocomplete="username"
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<label class="eyebrow text-eyebrow text-paper/60" for="admin-login-password">
						{m.admin_login_password()}
					</label>
					<div class="relative">
						<!-- `.field` pads 1rem on the right; the extra pr-12 (utilities outrank
						     the components layer) keeps a long value from running under the
						     toggle. -->
						<input
							id="admin-login-password"
							class="field pr-12"
							type={passwordVisible ? 'text' : 'password'}
							name="password"
							autocomplete="current-password"
							required
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-paper/60 transition-colors hover:text-yellow"
							onclick={() => (passwordVisible = !passwordVisible)}
							aria-label={passwordVisible
								? m.admin_login_password_hide()
								: m.admin_login_password_show()}
							aria-controls="admin-login-password"
						>
							{#if passwordVisible}
								<svg
									class="size-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path
										d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
									/>
									<path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
									<path d="M9.9 4.24 14.12 14.12" />
									<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
									<path d="m2 2 20 20" />
								</svg>
							{:else}
								<svg
									class="size-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<button type="submit" class="btn btn-red mt-1 cursor-pointer" disabled={pending}>
					{pending ? m.admin_login_pending() : m.admin_login_submit()}
				</button>
			</form>
		</div>
	</div>
</div>
