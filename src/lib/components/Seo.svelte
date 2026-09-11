<script lang="ts">
	import { page } from '$app/state';
	import { baseLocale, getLocale, locales } from '#lib/paraglide/runtime';
	import { absoluteUrl, isoDate, jsonLdScript, ogLocale, type JsonLd } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';

	let {
		title,
		description,
		path,
		image,
		type = 'website',
		article,
		jsonLd
	}: {
		/** The complete document title - compose it with `pageTitle()`. */
		title: string;
		description: string;
		/**
		 * The un-localized route path, `/blog` or `/blog/<slug>`, without any query
		 * string: it is localized and made absolute here, and becomes both the
		 * canonical and `og:url`. Leave it out on a page that has no address of
		 * its own, such as the error page.
		 */
		path?: string;
		/** Absolute URL of the 1200x630 Open Graph image. */
		image: string;
		type?: 'website' | 'article';
		article?: {
			publishedAt: Date | number | null;
			modifiedAt?: Date | number | null;
			section?: string;
		};
		jsonLd?: JsonLd | JsonLd[];
	} = $props();

	const locale = getLocale();

	const origin = $derived(page.url.origin);
	const url = $derived(path === undefined ? undefined : absoluteUrl(origin, path));
	const publishedTime = $derived(isoDate(article?.publishedAt));
	const modifiedTime = $derived(isoDate(article?.modifiedAt));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if url}
		<link rel="canonical" href={url} />
	{/if}

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={m.site_name()} />
	<meta property="og:locale" content={ogLocale(locale)} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if url}
		<meta property="og:url" content={url} />
	{/if}
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:alt" content={title} />
	{#if type === 'article'}
		{#if publishedTime}
			<meta property="article:published_time" content={publishedTime} />
		{/if}
		{#if modifiedTime}
			<meta property="article:modified_time" content={modifiedTime} />
		{/if}
		{#if article?.section}
			<meta property="article:section" content={article.section} />
		{/if}
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />

	<!-- With a single locale there is nothing to point at, and a lone self-referencing
	     alternate is noise; the block switches itself on when a second locale is added. -->
	{#if locales.length > 1 && path !== undefined}
		{#each locales as alternate (alternate)}
			<link rel="alternate" hreflang={alternate} href={absoluteUrl(origin, path, alternate)} />
		{/each}
		<link rel="alternate" hreflang="x-default" href={absoluteUrl(origin, path, baseLocale)} />
	{/if}

	{#if jsonLd}
		<!-- `jsonLdScript` writes every `<` as a JSON escape, so nothing in the data -
		     an article title, the address typed in the admin panel - can close the
		     script element. That is what makes this safe, and why the rule is silenced. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLdScript(jsonLd)}
	{/if}
</svelte:head>
