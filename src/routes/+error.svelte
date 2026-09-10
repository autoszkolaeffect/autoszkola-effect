<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime';
	import * as m from '#lib/paraglide/messages';
	import logo from '#lib/assets/efekt-logo.jpg';

	// The root error page, so it also covers URLs that matched no route at all and
	// therefore never reached the site layout - hence its own minimal chrome.
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? m.error_404_title() : m.error_title()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center">
	<a href={localizeHref('/')} class="mb-10">
		<img src={logo} alt={m.logo_alt()} class="h-12 w-auto" width="162" height="48" />
	</a>

	<div class="section-rule mx-auto bg-red"></div>

	<p class="mb-3 font-display text-[clamp(3rem,10vw,5rem)] leading-none font-bold text-yellow">
		{page.status}
	</p>

	<h1 class="mb-4 text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-paper">
		{notFound ? m.error_404_title() : m.error_title()}
	</h1>

	<p class="mb-10 max-w-[480px] text-paper/70">
		{notFound ? m.error_404_body() : m.error_generic_body()}
	</p>

	<a href={localizeHref('/')} class="btn btn-red">{m.error_back_home()}</a>
</div>
