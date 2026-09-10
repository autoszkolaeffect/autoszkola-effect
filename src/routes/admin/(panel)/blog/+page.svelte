<script lang="ts">
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { listPostsForAdmin } from '#lib/remote/admin-blog.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import { accentClasses } from '#lib/accents';
	import { formatLongDate } from '#lib/format';
	import { pickTranslation } from '#lib/locales';
	import * as m from '#lib/paraglide/messages';

	const posts = await listPostsForAdmin();
	const locale = getLocale();

	const untitled = m.admin_blog_untitled();

	const rows = posts.map((post) => {
		const translation = pickTranslation(post.translations, locale);
		const category = post.category
			? pickTranslation(post.category.translations, locale)?.label
			: undefined;

		return {
			id: post.id,
			status: post.status,
			title: translation?.title || untitled,
			// A draft usually has no date yet, so the separator only appears when
			// there are two halves to separate.
			meta: [
				formatLongDate(post.publishedAt, locale),
				m.blog_reading_time({ minutes: post.readingMinutes })
			]
				.filter(Boolean)
				.join(' · '),
			category,
			accent: accentClasses(post.category?.accent)
		};
	});

	const groups = [
		{ status: 'published', label: m.admin_status_published() },
		{ status: 'draft', label: m.admin_status_draft() }
	].map((group) => ({ ...group, rows: rows.filter((row) => row.status === group.status) }));
</script>

<AdminPage title={m.admin_blog_title()} intro={m.admin_blog_intro()}>
	{#snippet actions()}
		<a href={localizeHref('/admin/blog/categories')} class="btn btn-ghost px-5 py-2 text-label">
			{m.admin_blog_categories()}
		</a>
		<a href={localizeHref('/admin/blog/new')} class="btn btn-red px-5 py-2 text-label">
			{m.admin_blog_new()}
		</a>
	{/snippet}

	{#if rows.length === 0}
		<AdminEmpty text={m.admin_blog_empty()} />
	{:else}
		<div class="flex flex-col gap-10">
			{#each groups as group (group.status)}
				{#if group.rows.length > 0}
					<section>
						<h2 class="eyebrow mb-4 text-eyebrow font-normal text-paper/55">
							{group.label} · {group.rows.length}
						</h2>

						<ul class="flex flex-col gap-px">
							{#each group.rows as row (row.id)}
								<li>
									<a
										href={localizeHref(`/admin/blog/${row.id}`)}
										class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-l-3 bg-blue px-5 py-4 transition-colors hover:bg-blue/75 {row
											.accent.border}"
									>
										<span class="min-w-0 flex-1">
											<span class="block font-display text-body-lg font-bold text-paper">
												{row.title}
											</span>
											{#if row.category}
												<!-- The badge carries the category's own accent, as it does
												     on the public blog card. -->
												<span
													class="eyebrow mt-2 inline-block px-chip py-sliver text-micro font-bold {row
														.accent.solid}"
												>
													{row.category}
												</span>
											{/if}
										</span>

										<span class="text-note whitespace-nowrap text-paper/50">
											{row.meta}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
</AdminPage>
