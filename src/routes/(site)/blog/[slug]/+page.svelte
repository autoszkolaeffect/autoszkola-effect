<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { getBlogPost } from '#lib/remote/site.remote';
	import { accentClasses } from '#lib/accents';
	import { formatLongDate } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	// `params` rather than `page.params`: only the route's own type knows that
	// `slug` is always present here.
	const { params }: PageProps = $props();

	// Derived rather than awaited once, so that following a link to another
	// article re-reads the query instead of keeping the first one on screen.
	// `error` returns `never`, which both narrows `post` and turns an unknown or
	// unpublished slug into a real 404 rather than an empty article.
	const post = $derived(
		(await getBlogPost({ locale: getLocale(), slug: params.slug })) ??
			error(404, m.error_404_title())
	);

	const accent = $derived(accentClasses(post.categoryAccent));
</script>

<svelte:head>
	<title>{post.title}</title>
	<meta name="description" content={post.excerpt} />
</svelte:head>

<article class="mx-auto max-w-[760px] px-6 pt-12 pb-20">
	<a href={localizeHref('/blog')} class="mb-10 inline-block text-[0.9rem] text-yellow">
		{m.blog_back()}
	</a>

	{#if post.categoryLabel}
		<p
			class="mb-5 inline-block px-3 py-[0.3rem] text-[0.75rem] font-bold tracking-[0.12em] uppercase {accent.solid}"
		>
			{post.categoryLabel}
		</p>
	{/if}

	<h1 class="mb-4 text-[clamp(1.7rem,4vw,2.5rem)] leading-[1.2] font-bold text-paper">
		{post.title}
	</h1>

	<div class="mb-10 flex flex-wrap gap-6 text-[0.85rem] text-paper/45">
		<span>{formatLongDate(post.publishedAt)}</span>
		<span>{m.blog_reading_time_long({ minutes: post.readingMinutes })}</span>
	</div>

	<div class="mb-10 h-[3px] w-full {accent.bg}"></div>

	{#if post.excerpt}
		<p class="mb-10 text-[1.05rem] leading-[1.75] text-paper/75 italic">{post.excerpt}</p>
	{/if}

	<!-- Rendered server-side by markdown-it with `html: false` (see src/lib/markdown.ts),
	     which escapes any markup an author types rather than passing it through. That is
	     what makes this safe without a sanitiser, and why the rule is silenced here. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="markdown-body">{@html post.html}</div>
</article>
