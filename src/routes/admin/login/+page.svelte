<script lang="ts">
	import { enhance } from '$app/forms';
	import { pageTitle } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';
	import logo from '#lib/assets/efekt-logo.jpg';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let pending = $state(false);
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
					<input
						id="admin-login-password"
						class="field"
						type="password"
						name="password"
						autocomplete="current-password"
						required
					/>
				</div>

				<button type="submit" class="btn btn-red mt-1 cursor-pointer" disabled={pending}>
					{pending ? m.admin_login_pending() : m.admin_login_submit()}
				</button>
			</form>
		</div>
	</div>
</div>
