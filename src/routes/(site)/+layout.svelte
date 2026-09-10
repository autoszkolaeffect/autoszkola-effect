<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime';
	import { getSiteContact } from '#lib/remote/site.remote';
	import SiteNav from '#lib/components/SiteNav.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import * as m from '#lib/paraglide/messages';

	let { children } = $props();

	// Awaited here rather than in a `load`: the navigation bar's phone number and
	// the footer's address come from the same admin-editable record, and every
	// page needs both. The query is cached per locale, so it is fetched once.
	const contact = await getSiteContact(getLocale());
</script>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-200 focus:bg-yellow focus:px-4 focus:py-2 focus:font-bold focus:text-navy"
>
	{m.skip_to_content()}
</a>

<SiteNav {contact} />

<main id="main" class="min-h-screen bg-navy">
	{@render children()}
</main>

<SiteFooter {contact} />
