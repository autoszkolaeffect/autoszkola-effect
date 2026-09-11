<script lang="ts">
	import { page } from '$app/state';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import Seo from '#lib/components/Seo.svelte';
	import { metaDescription, ogImageHref, pageTitle } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';
	import logo from '#lib/assets/efekt-logo.jpg';

	// The root error page, so it also covers URLs that matched no route at all and
	// therefore never reached the site layout - hence its own minimal chrome.
	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? m.error_404_title() : m.error_title());
	const body = $derived(notFound ? m.error_404_body() : m.error_generic_body());
</script>

<!-- No `path`: an error renders at whatever URL failed, so there is no canonical
     address to point at - and the page is kept out of the index regardless. -->
<Seo
	title={pageTitle(heading)}
	description={metaDescription(body)}
	image={ogImageHref(page.url.origin, getLocale(), 'home')}
/>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center">
	<a href={localizeHref('/')} class="mb-10">
		<img src={logo} alt={m.logo_alt()} class="h-12 w-auto" width="162" height="48" />
	</a>

	<div class="section-rule mx-auto bg-red"></div>

	<p class="mb-3 font-display text-error-code leading-none font-bold text-yellow">
		{page.status}
	</p>

	<h1 class="mb-4 text-error-title font-bold text-paper">{heading}</h1>

	<p class="mb-10 max-w-120 text-paper/70">{body}</p>

	<a href={localizeHref('/')} class="btn btn-red">{m.error_back_home()}</a>
</div>
