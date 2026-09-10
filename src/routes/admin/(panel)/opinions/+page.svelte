<script lang="ts">
	import { tick } from 'svelte';
	import {
		deleteOpinion,
		listOpinionsForAdmin,
		moveOpinion,
		saveOpinion,
		type AdminOpinion
	} from '#lib/remote/admin-opinions.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { indexOfLocale } from '#lib/locales';
	import * as m from '#lib/paraglide/messages';

	// Derived rather than awaited once: every mutation below refreshes this query
	// on the server, and a snapshot would keep showing the rows - and the stored
	// text a saved form falls back to - from before the change.
	const opinions = $derived(await listOpinionsForAdmin());

	const RATINGS = [1, 2, 3, 4, 5];

	const EMPTY_TEXT = { author: '', quote: '' };

	// The row the "new opinion" card edits. Its empty id is what tells the remote
	// function to insert rather than update, and the key its form instance takes.
	const BLANK: AdminOpinion = { id: '', rating: 5, published: true, translations: {} };

	let creating = $state(false);

	/**
	 * What the editor has typed, falling back to what is stored. A form field
	 * holds no value of its own until it is edited - the stored value reaches the
	 * input as its default rather than as form state.
	 */
	const typed = (value: unknown, stored: string) => (typeof value === 'string' ? value : stored);

	const chosenRating = (value: unknown, stored: number) => {
		const rating = Number(value);
		return rating >= 1 && rating <= 5 ? rating : stored;
	};

	const arrowClass =
		'flex h-9 w-9 items-center justify-center border-2 border-yellow/60 text-yellow transition-colors hover:border-yellow disabled:opacity-35';

	// A command rejects on an expired session or a dropped connection, and the
	// reorder and delete buttons are the only place on this screen where nothing
	// else would say so.
	let failed = $state(false);

	async function run(action: () => Promise<unknown>) {
		failed = false;

		try {
			await action();
		} catch {
			failed = true;
		}
	}

	async function remove(id: string) {
		if (!confirm(m.admin_delete_confirm())) return;

		await run(() => deleteOpinion(id));
	}
</script>

<AdminPage title={m.admin_opinions_title()} intro={m.admin_opinions_intro()}>
	{#snippet actions()}
		<button type="button" class="btn btn-yellow" onclick={() => (creating = !creating)}>
			{creating ? m.admin_cancel() : m.admin_opinions_new()}
		</button>
	{/snippet}

	<div class="flex flex-col gap-5">
		{#if failed}
			<p class="border-l-3 border-red bg-red/20 px-4 py-3 text-caption text-paper" role="alert">
				{m.admin_error_generic()}
			</p>
		{/if}

		{#if creating}
			{@render editor(BLANK, -1)}
		{/if}

		{#each opinions as row, index (row.id)}
			{@render editor(row, index)}
		{/each}

		{#if opinions.length === 0 && !creating}
			<AdminEmpty text={m.admin_opinions_empty()} />
		{/if}
	</div>
</AdminPage>

{#snippet editor(row: AdminOpinion, index: number)}
	{@const isNew = row.id === ''}
	{@const editing = saveOpinion.for(row.id)}
	{@const fields = editing.fields}
	{@const pending = editing.pending > 0}
	{@const saved = editing.result?.ok === true && !pending && !fields.dirty()}

	<AdminCard title={isNew ? m.admin_opinions_new() : undefined}>
		<form
			{...editing.enhance(async (instance) => {
				if (!(await instance.submit())) return;

				// Taking over `enhance` also takes over the reset the default callback
				// does, and that reset is what hands the fields back to the refreshed
				// query - and what clears `dirty`, so the "saved" note can appear.
				// The form is gone already if the row left the list mid-save.
				await tick();
				instance.element?.reset();

				// The new card's id stays empty whatever it just created, so leaving
				// it open would let a second save insert a copy rather than edit the
				// row that is now in the list below.
				if (isNew) creating = false;
			})}
			class="flex flex-col gap-5"
		>
			<input {...fields.id.as('hidden', row.id)} />

			{#each fields.issues() ?? [] as issue, position (position)}
				<p class="border-l-3 border-red bg-red/20 px-3 py-2 text-note leading-normal text-paper">
					{issue.message}
				</p>
			{/each}

			<LocaleTabs>
				{#snippet children(locale)}
					{@const stored = row.translations[locale] ?? EMPTY_TEXT}
					{@const text = fields.translations[indexOfLocale(locale)]}
					{@const rating = chosenRating(fields.rating.value(), row.rating)}

					<div class="grid gap-6 lg:grid-editor">
						<div class="flex min-w-0 flex-col gap-4">
							<AdminField
								label={m.admin_opinions_author()}
								hint={m.admin_opinions_author_hint()}
								issues={text.author.issues()}
							>
								{#snippet children(id, aria)}
									<input {id} class="field" {...text.author.as('text', stored.author)} {...aria} />
								{/snippet}
							</AdminField>

							<AdminField label={m.admin_opinions_quote()} issues={text.quote.issues()}>
								{#snippet children(id, aria)}
									<textarea
										{id}
										rows={4}
										class="field"
										{...text.quote.as('text', stored.quote)}
										{...aria}></textarea>
								{/snippet}
							</AdminField>
						</div>

						<!-- The card as the home page draws it - docs/DESIGN.md 3.4. -->
						<div>
							<p class="eyebrow mb-2 text-eyebrow text-paper/50">{m.admin_opinions_preview()}</p>

							<figure class="border-t-3 border-yellow bg-navy p-7">
								<span
									class="text-lead tracking-stars text-yellow"
									aria-label={m.opinions_rating({ rating })}
								>
									{'★'.repeat(rating)}
								</span>
								<blockquote class="mt-3 mb-4 text-body leading-body text-paper/85 italic">
									{typed(text.quote.value(), stored.quote)}
								</blockquote>
								<figcaption class="font-display text-label font-bold text-yellow">
									- {typed(text.author.value(), stored.author)}
								</figcaption>
							</figure>
						</div>
					</div>
				{/snippet}
			</LocaleTabs>

			<div
				class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-white/10 pt-5"
			>
				<div class="flex flex-wrap items-end gap-6">
					<div class="w-36">
						<AdminField label={m.admin_opinions_rating()} issues={fields.rating.issues()}>
							{#snippet children(id, aria)}
								<select
									{id}
									class="field"
									{...fields.rating.as('select', String(row.rating))}
									{...aria}
								>
									{#each RATINGS as rating (rating)}
										<option value={String(rating)}>{'★'.repeat(rating)}</option>
									{/each}
								</select>
							{/snippet}
						</AdminField>
					</div>

					<label class="flex items-center gap-2 pb-cozy text-excerpt text-paper/80">
						<input
							class="size-4 rounded-none border-white/25 bg-navy text-yellow"
							{...fields.published.as('checkbox', row.published)}
						/>
						{m.admin_visible()}
					</label>
				</div>

				<div class="flex flex-wrap items-center gap-3">
					{#if saved}
						<span class="text-meta text-yellow" role="status">{m.admin_saved()}</span>
					{/if}

					<button type="submit" class="btn btn-yellow px-6 py-tag text-label" disabled={pending}>
						{pending ? m.admin_saving() : m.admin_save()}
					</button>

					{#if !isNew}
						<div class="flex items-center gap-2">
							<button
								type="button"
								class={arrowClass}
								aria-label={m.admin_move_up()}
								disabled={index === 0 || moveOpinion.pending > 0}
								onclick={() => run(() => moveOpinion({ id: row.id, direction: 'up' }))}
							>
								↑
							</button>
							<button
								type="button"
								class={arrowClass}
								aria-label={m.admin_move_down()}
								disabled={index === opinions.length - 1 || moveOpinion.pending > 0}
								onclick={() => run(() => moveOpinion({ id: row.id, direction: 'down' }))}
							>
								↓
							</button>
						</div>

						<button
							type="button"
							class="border-2 border-red px-4 py-2 text-meta font-bold text-paper transition-colors hover:bg-red disabled:opacity-55"
							disabled={deleteOpinion.pending > 0}
							onclick={() => remove(row.id)}
						>
							{m.admin_delete()}
						</button>
					{/if}
				</div>
			</div>
		</form>
	</AdminCard>
{/snippet}
