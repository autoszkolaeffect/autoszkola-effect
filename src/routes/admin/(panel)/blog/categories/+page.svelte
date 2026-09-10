<script lang="ts">
	import { localizeHref } from '#lib/paraglide/runtime';
	import {
		deleteCategory,
		listCategoriesForAdmin,
		saveCategory,
		type AdminBlogCategory
	} from '#lib/remote/admin-blog.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { ACCENTS, accentClasses, type Accent } from '#lib/accents';
	import { contentLocales } from '#lib/locales';
	import * as m from '#lib/paraglide/messages';

	// Derived rather than awaited once: saving and deleting refresh this query on
	// the server, and a snapshot would keep listing the categories as they were
	// when the screen opened.
	const categories = $derived(await listCategoriesForAdmin());

	// `for(id)` gives each row its own submission state, so a validation error on
	// one category does not light up the others.
	type CategoryForm = ReturnType<typeof saveCategory.for>;

	const accentLabels: Record<Accent, string> = {
		red: m.admin_accent_red(),
		yellow: m.admin_accent_yellow(),
		blue: m.admin_accent_blue(),
		orange: m.admin_accent_orange()
	};

	/** The label a category carries in `entryLocale`, empty when it has none yet. */
	const labelFor = (category: AdminBlogCategory | null, entryLocale: string) =>
		category?.translations.find((row) => row.locale === entryLocale)?.label ?? '';

	const postCount = (count: number) => m.admin_blog_category_posts({ count });

	// The refusal to delete a category in use comes back as a result rather than
	// an exception, so it is shown against the row it belongs to.
	let refusals = $state<Record<string, string>>({});

	async function remove(id: string) {
		if (!confirm(m.admin_delete_confirm())) return;

		const result = await deleteCategory(id);

		if (result.ok) {
			delete refusals[id];
		} else {
			refusals[id] = result.message;
		}
	}
</script>

<AdminPage title={m.admin_blog_categories()}>
	{#snippet actions()}
		<a href={localizeHref('/admin/blog')} class="text-caption text-yellow">
			{m.admin_back_to_list()}
		</a>
	{/snippet}

	<div class="flex flex-col gap-6">
		{#each categories as category (category.id)}
			<AdminCard>
				{@render editor(saveCategory.for(category.id), category)}
			</AdminCard>
		{/each}

		<AdminCard title={m.admin_blog_category_new()}>
			{@render editor(saveCategory, null)}
		</AdminCard>
	</div>
</AdminPage>

{#snippet editor(instance: CategoryForm, category: AdminBlogCategory | null)}
	{@const fields = instance.fields}
	{@const accent = fields.accent.value() ?? category?.accent ?? 'red'}

	<form
		{...instance.enhance(async (form) => {
			await form.submit();

			// A "new category" form that kept its values would try to save the
			// same slug again on the next click.
			if (!category && form.result?.ok) form.fields.set({});
		})}
		class="flex flex-col gap-5"
	>
		<input {...fields.id.as('hidden', category?.id ?? '')} />

		<LocaleTabs>
			{#snippet children(active)}
				{#each contentLocales as entryLocale, index (entryLocale)}
					<!-- Hidden rather than unmounted: a form submits the inputs that are
					     in the DOM, so dropping the tab the editor left would wipe its
					     translation. -->
					<div hidden={entryLocale !== active}>
						<input {...fields.translations[index].locale.as('hidden', entryLocale)} />

						<AdminField
							label={m.admin_blog_category_label()}
							issues={fields.translations[index].label.issues()}
						>
							{#snippet children(id, aria)}
								<input
									{id}
									{...fields.translations[index].label.as('text', labelFor(category, entryLocale))}
									{...aria}
									class="field"
								/>
							{/snippet}
						</AdminField>
					</div>
				{/each}
			{/snippet}
		</LocaleTabs>

		<div class="grid grid-chips gap-5">
			<AdminField label={m.admin_blog_category_slug()} issues={fields.slug.issues()}>
				{#snippet children(id, aria)}
					<input {id} {...fields.slug.as('text', category?.slug ?? '')} {...aria} class="field" />
				{/snippet}
			</AdminField>

			<AdminField label={m.admin_blog_category_accent()} issues={fields.accent.issues()}>
				{#snippet children(id, aria)}
					<div class="flex items-center gap-3">
						<select
							{id}
							{...fields.accent.as('select', category?.accent ?? 'red')}
							{...aria}
							class="field"
						>
							{#each ACCENTS as option (option)}
								<option value={option}>{accentLabels[option]}</option>
							{/each}
						</select>
						<span aria-hidden="true" class="block h-9 w-9 shrink-0 {accentClasses(accent).bg}"
						></span>
					</div>
				{/snippet}
			</AdminField>

			<AdminField label={m.admin_sort_order()} issues={fields.sortOrder.issues()}>
				{#snippet children(id, aria)}
					<input
						{id}
						{...fields.sortOrder.as('number', category?.sortOrder ?? 0)}
						{...aria}
						min="0"
						max="999"
						class="field"
					/>
				{/snippet}
			</AdminField>
		</div>

		{#if category && refusals[category.id]}
			<p class="border-l-3 border-red bg-red/20 px-3 py-2 text-note text-paper" role="alert">
				{refusals[category.id]}
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-4">
			<button
				type="submit"
				class="btn btn-red px-6 py-2 text-label"
				disabled={instance.pending > 0}
			>
				{instance.pending > 0 ? m.admin_saving() : category ? m.admin_save() : m.admin_add()}
			</button>

			{#if instance.result?.ok}
				<span class="text-caption text-yellow" role="status">{m.admin_saved()}</span>
			{/if}

			{#if category}
				<span class="text-note text-paper/45">{postCount(category.posts)}</span>

				<button
					type="button"
					onclick={() => remove(category.id)}
					class="ml-auto border-2 border-red px-4 py-chip text-meta text-paper transition-colors hover:bg-red"
				>
					{m.admin_delete()}
				</button>
			{/if}
		</div>
	</form>
{/snippet}
