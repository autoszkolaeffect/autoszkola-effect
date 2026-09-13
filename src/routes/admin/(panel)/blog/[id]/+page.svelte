<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import {
		deletePost,
		getPostForAdmin,
		listCategoriesForAdmin,
		savePost
	} from '#lib/remote/admin-blog.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import MarkdownEditor from '#lib/components/admin/MarkdownEditor.svelte';
	import { baseLocale, byLocale, contentLocales, pickTranslation } from '#lib/locales';
	import { estimateReadingMinutes } from '#lib/markdown';
	import { toDateInputValue } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	// `params` rather than `page.params`: only the route's own type knows that
	// `id` is always present here.
	const { params }: PageProps = $props();

	// `new` is the placeholder segment the list links to when there is nothing
	// to load yet; every real post is addressed by its id.
	const isNew = $derived(params.id === 'new');

	// Derived rather than awaited once: SvelteKit keeps this component mounted
	// when the route moves from one post to another, so a snapshot would leave
	// the first post on screen.
	const post = $derived(isNew ? null : await getPostForAdmin(params.id));
	const categories = $derived(await listCategoriesForAdmin());
	const locale = getLocale();

	const translations = $derived(
		byLocale(post?.translations ?? [], (entryLocale) => ({
			locale: entryLocale,
			slug: '',
			title: '',
			excerpt: '',
			body: ''
		}))
	);

	// One form instance per post, so what is typed into one post's form never
	// resurfaces in another's.
	const save = $derived(savePost.for(params.id));
	const fields = $derived(save.fields);

	// The markdown lives here rather than in the form's own field state because
	// the editor is a controlled component - see MarkdownEditor.svelte, which
	// mirrors it back into a named textarea so it still submits. It is tagged
	// with the post it belongs to for the same reason `savePost.for()` is keyed:
	// otherwise one post's unsaved text would be submitted with the next one.
	let edited = $state<{ id: string; bodies: string[] } | null>(null);

	const bodies = $derived(
		edited?.id === params.id
			? edited.bodies
			: contentLocales.map((entryLocale) => translations[entryLocale].body)
	);

	function editBody(index: number, value: string) {
		const next = [...bodies];
		next[index] = value;
		edited = { id: params.id, bodies: next };
	}

	const pending = $derived(save.pending > 0);
	const saved = $derived(save.result?.ok === true);

	const categoryOptions = $derived(
		categories.map((category) => ({
			id: category.id,
			label: pickTranslation(category.translations, locale)?.label || category.slug
		}))
	);

	const statusOptions = [
		{ value: 'draft', label: m.admin_status_draft() },
		{ value: 'published', label: m.admin_status_published() }
	];

	const baseIndex = contentLocales.indexOf(baseLocale);

	function recomputeReadingMinutes() {
		// Reading time is a single column shared by every locale, so it is
		// measured against the base locale's text rather than whichever tab the
		// editor happens to have open.
		fields.readingMinutes.set(estimateReadingMinutes(bodies[baseIndex] ?? ''));
	}

	let deleting = $state(false);

	async function remove() {
		if (!post || !confirm(m.admin_delete_confirm())) return;

		deleting = true;

		try {
			await deletePost(post.id);
			await goto(localizeHref('/admin/blog'));
		} finally {
			deleting = false;
		}
	}
</script>

<AdminPage title={isNew ? m.admin_blog_new() : m.admin_blog_edit()}>
	{#snippet actions()}
		<a
			href={localizeHref('/admin/blog')}
			class="inline-flex items-center gap-1 text-caption text-yellow"
		>
			<ArrowLeft class="size-4" aria-hidden="true" />
			{m.admin_back_to_list()}
		</a>
	{/snippet}

	{#if !isNew && !post}
		<AdminEmpty text={m.error_404_body()} />
	{:else}
		<form {...save} class="flex flex-col gap-6">
			<input {...fields.id.as('hidden', post?.id ?? '')} />

			<AdminCard>
				<div class="grid grid-fields gap-5">
					<AdminField label={m.admin_blog_category()} issues={fields.categoryId.issues()}>
						{#snippet children(id, aria)}
							<select
								{id}
								{...fields.categoryId.as('select', post?.categoryId ?? '')}
								{...aria}
								class="field"
							>
								<option value="">{m.admin_blog_category_none()}</option>
								{#each categoryOptions as option (option.id)}
									<option value={option.id}>{option.label}</option>
								{/each}
							</select>
						{/snippet}
					</AdminField>

					<AdminField label={m.admin_blog_status()} issues={fields.status.issues()}>
						{#snippet children(id, aria)}
							<select
								{id}
								{...fields.status.as('select', post?.status ?? 'draft')}
								{...aria}
								class="field"
							>
								{#each statusOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						{/snippet}
					</AdminField>

					<AdminField label={m.admin_blog_published_at()} issues={fields.publishedAt.issues()}>
						{#snippet children(id, aria)}
							<input
								{id}
								{...fields.publishedAt.as('date', toDateInputValue(post?.publishedAt))}
								{...aria}
								class="field"
							/>
						{/snippet}
					</AdminField>

					<AdminField
						label={m.admin_blog_reading_minutes()}
						issues={fields.readingMinutes.issues()}
					>
						{#snippet children(id, aria)}
							<div class="flex items-center gap-2">
								<input
									{id}
									{...fields.readingMinutes.as('number', post?.readingMinutes ?? 1)}
									{...aria}
									min="1"
									max="240"
									class="field w-24"
								/>
								<button
									type="button"
									onclick={recomputeReadingMinutes}
									class="text-hint text-yellow underline underline-offset-4"
								>
									{m.admin_blog_reading_minutes_auto()}
								</button>
							</div>
						{/snippet}
					</AdminField>
				</div>
			</AdminCard>

			<AdminCard>
				<LocaleTabs>
					{#snippet children(active)}
						{#each contentLocales as entryLocale, index (entryLocale)}
							<!-- Every locale stays mounted, hidden or not: a form submits the
							     inputs that are in the DOM, so unmounting the tab the editor
							     just left would silently wipe its translation. -->
							<div class="flex flex-col gap-5" hidden={entryLocale !== active}>
								<input {...fields.translations[index].locale.as('hidden', entryLocale)} />

								<AdminField
									label={m.admin_blog_post_title()}
									issues={fields.translations[index].title.issues()}
								>
									{#snippet children(id, aria)}
										<input
											{id}
											{...fields.translations[index].title.as(
												'text',
												translations[entryLocale].title
											)}
											{...aria}
											class="field"
										/>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_blog_slug()}
									hint={m.admin_blog_slug_hint()}
									issues={fields.translations[index].slug.issues()}
								>
									{#snippet children(id, aria)}
										<input
											{id}
											{...fields.translations[index].slug.as(
												'text',
												translations[entryLocale].slug ?? ''
											)}
											{...aria}
											class="field"
										/>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_blog_excerpt()}
									hint={m.admin_blog_excerpt_hint()}
									issues={fields.translations[index].excerpt.issues()}
								>
									{#snippet children(id, aria)}
										<textarea
											{id}
											{...fields.translations[index].excerpt.as(
												'text',
												translations[entryLocale].excerpt
											)}
											{...aria}
											rows="3"
											class="field"></textarea>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_blog_body()}
									hint={m.admin_blog_body_hint()}
									issues={fields.translations[index].body.issues()}
								>
									{#snippet children(id, aria)}
										<MarkdownEditor
											{id}
											{aria}
											bind:value={() => bodies[index], (value) => editBody(index, value)}
											name={fields.translations[index].body.as('text').name}
										/>
									{/snippet}
								</AdminField>
							</div>
						{/each}
					{/snippet}
				</LocaleTabs>
			</AdminCard>

			<div class="flex flex-wrap items-center gap-4">
				<button type="submit" class="btn btn-red px-8 py-3 cursor-pointer" disabled={pending}>
					{pending ? m.admin_saving() : m.admin_save()}
				</button>

				{#if saved}
					<span class="text-caption text-yellow" role="status">{m.admin_saved()}</span>
				{/if}

				{#if post}
					<button
						type="button"
						onclick={remove}
						disabled={deleting}
						class="ml-auto border-2 border-red px-5 py-2 text-caption text-paper transition-colors hover:bg-red disabled:opacity-55"
					>
						{deleting ? m.admin_deleting() : m.admin_delete()}
					</button>
				{/if}
			</div>
		</form>
	{/if}
</AdminPage>
