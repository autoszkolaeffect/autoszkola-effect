<script lang="ts">
	import { page } from '$app/state';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { listBlogCategories, listBlogPosts } from '#lib/remote/site.remote';
	import { accentClasses } from '#lib/accents';
	import { formatLongDate } from '#lib/format';
	import * as m from '#lib/paraglide/messages';

	// Polish query parameter, for the same reason the routes are Polish.
	const CATEGORY_PARAM = 'kategoria';

	const locale = getLocale();
	const [posts, categories] = await Promise.all([
		listBlogPosts(locale),
		listBlogCategories(locale)
	]);

	// A category with nothing published behind it would give a chip that filters
	// the grid down to nothing, so it never gets one.
	const usedCategories = categories.filter((category) =>
		posts.some((post) => post.categorySlug === category.slug)
	);

	// The URL is the only source of truth for the filter, and the chips are real
	// links rather than buttons driving local state. That makes each choice
	// linkable and shareable, keeps back and forward working, and costs nothing:
	// `listBlogPosts` is a cached remote query, so navigating between chips
	// re-renders from memory without another round trip.
	const activeCategory = $derived(page.url.searchParams.get(CATEGORY_PARAM));

	const visiblePosts = $derived(
		activeCategory ? posts.filter((post) => post.categorySlug === activeCategory) : posts
	);

	function categoryHref(slug: string | null): string {
		const path = slug ? `/blog?${CATEGORY_PARAM}=${encodeURIComponent(slug)}` : '/blog';
		return localizeHref(path);
	}

	const chipClasses = (on: boolean) =>
		on
			? 'border-yellow bg-yellow font-bold text-navy'
			: 'border-white/25 bg-transparent font-normal text-paper/70';
</script>

<svelte:head>
	<title>{m.blog_title()} - {m.site_name()}</title>
	<meta name="description" content={m.blog_intro()} />
</svelte:head>

<!-- Header band, with the filter chips inside it ---------------------------->
<section class="border-b-4 border-yellow bg-blue px-6 pt-16 pb-12">
	<div class="mx-auto max-w-[1100px]">
		<div class="section-rule bg-yellow"></div>
		<h1 class="mb-4 text-[clamp(2rem,5vw,3.2rem)] font-bold text-paper">{m.blog_title()}</h1>
		<p class="mb-8 max-w-[580px] text-[1.05rem] leading-[1.7] text-paper/80">
			{m.blog_intro()}
		</p>

		{#if usedCategories.length > 0}
			<div class="flex flex-wrap gap-2">
				<a
					href={categoryHref(null)}
					data-sveltekit-reset="false"
					aria-current={activeCategory === null ? 'page' : undefined}
					class="border-2 px-4 py-[0.4rem] text-[0.85rem] transition-colors duration-150 {chipClasses(
						activeCategory === null
					)}"
				>
					{m.blog_filter_all()}
				</a>

				{#each usedCategories as category (category.id)}
					<a
						href={categoryHref(category.slug)}
						data-sveltekit-reset="false"
						aria-current={activeCategory === category.slug ? 'page' : undefined}
						class="border-2 px-4 py-[0.4rem] text-[0.85rem] transition-colors duration-150 {chipClasses(
							activeCategory === category.slug
						)}"
					>
						{category.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>

<!-- Card grid --------------------------------------------------------------->
<section class="mx-auto max-w-[1100px] px-6 py-16">
	{#if posts.length === 0}
		<p class="text-[1.05rem] leading-[1.7] text-paper/70">{m.blog_empty()}</p>
	{:else if visiblePosts.length === 0}
		<p class="text-[1.05rem] leading-[1.7] text-paper/70">{m.blog_empty_in_category()}</p>
	{:else}
		<div class="grid [grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-7">
			{#each visiblePosts as post (post.id)}
				{@const accent = accentClasses(post.categoryAccent)}
				<a
					href={localizeHref(`/blog/${post.slug}`)}
					class="flex flex-col border-t-4 bg-blue transition-transform duration-[180ms] hover:-translate-y-1 {accent.border}"
				>
					<div class="flex-1 p-7">
						{#if post.categoryLabel}
							<span
								class="mb-4 inline-block px-[0.6rem] py-1 text-[0.72rem] font-bold tracking-[0.1em] uppercase {accent.solid}"
							>
								{post.categoryLabel}
							</span>
						{/if}
						<h2 class="mb-3 text-[1.1rem] leading-[1.35] font-bold text-paper">
							{post.title}
						</h2>
						<p class="text-[0.88rem] leading-[1.65] text-paper/70">{post.excerpt}</p>
					</div>

					<div class="flex items-center justify-between border-t border-white/10 px-7 py-4">
						<!-- The design's rgba(250,250,250,.4) is under 3:1 on #0A4295; the date
						     and reading time are content, so they take a readable tint. -->
						<span class="text-[0.78rem] text-paper/70">
							{formatLongDate(post.publishedAt)} · {m.blog_reading_time({
								minutes: post.readingMinutes
							})}
						</span>
						<span class="font-display text-[0.85rem] font-bold text-yellow">
							{m.blog_read_more()}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>
