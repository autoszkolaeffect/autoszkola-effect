<script lang="ts">
	import { page } from '$app/state';
	import { getLocale } from '#lib/paraglide/runtime';
	import { getSiteContact } from '#lib/remote/site.remote';
	import SiteNav from '#lib/components/SiteNav.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { absoluteUrl, jsonLdScript, logoHref, ogImageHref } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';

	let { children } = $props();

	const locale = getLocale();

	// Awaited here rather than in a `load`: the navigation bar's phone number and
	// the footer's address come from the same admin-editable record, and every
	// page needs both. The query is cached per locale, so it is fetched once.
	const contact = await getSiteContact(locale);

	// The school's structured-data record, emitted from the layout because this
	// is where its address and phone are already in hand and because it belongs
	// on every page, not one. Unset settings are `undefined`, which
	// `JSON.stringify` drops - a field the admin left blank is absent, not empty.
	const business = $derived.by(() => {
		const origin = page.url.origin;
		const hasAddress = Boolean(contact.addressLine1 || contact.addressLine2);

		return {
			'@context': 'https://schema.org',
			'@type': 'LocalBusiness',
			name: m.site_name(),
			legalName: contact.companyName || undefined,
			url: absoluteUrl(origin, '/'),
			logo: logoHref(origin),
			image: ogImageHref(origin, locale, 'home'),
			telephone: contact.primaryPhone?.number || undefined,
			email: contact.email || undefined,
			address: hasAddress
				? {
						'@type': 'PostalAddress',
						streetAddress: contact.addressLine1 || undefined,
						// The panel labels the second line "Miasto", so it is the locality.
						addressLocality: contact.addressLine2 || undefined,
						// Not admin-editable: the school teaches for a Polish licence, in Łódź.
						addressCountry: 'PL'
					}
				: undefined
		};
	});
</script>

<svelte:head>
	<!-- `jsonLdScript` writes every `<` as a JSON escape, so nothing typed into the
	     address in the admin panel can close the script element. That is what makes
	     this safe, and why the rule is silenced. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html jsonLdScript(business)}
</svelte:head>

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
