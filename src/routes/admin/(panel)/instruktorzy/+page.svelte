<script lang="ts">
	import { tick } from 'svelte';
	import { isLocale, localizeHref } from '#lib/paraglide/runtime';
	import {
		listInstructorsForAdmin,
		moveInstructor,
		setInstructorPublished,
		type AdminInstructorListItem
	} from '#lib/remote/admin-instructors.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { accentClasses, instructorAccent } from '#lib/accents';
	import * as m from '#lib/paraglide/messages';

	type Direction = 'up' | 'down';

	// Derived rather than awaited once, so reordering or hiding a row re-reads
	// the list instead of leaving the old order on screen.
	const instructors = $derived(await listInstructorsForAdmin());

	// LocaleTabs hands the active tab back as a plain string; narrowing it keeps
	// the per-locale record indexable without a cast.
	const translationOf = (row: AdminInstructorListItem, locale: string) =>
		isLocale(locale) ? row.translations[locale] : undefined;

	// The public grid only renders published instructors and cycles the accent
	// over what it renders, so a preview taken from the position in this list
	// would be wrong for every row below a hidden one.
	const publishedPositions = $derived(
		new Map(instructors.filter((row) => row.published).map((row, position) => [row.id, position]))
	);

	/** The accent the row's card takes on the public grid - none if it is hidden. */
	function accentPreview(row: AdminInstructorListItem) {
		const position = publishedPositions.get(row.id);

		if (position === undefined) return { edge: 'border-white/15', marker: 'bg-white/20' };

		const accent = accentClasses(instructorAccent(position));
		return { edge: accent.border, marker: accent.bg };
	}

	// A command rejects on an expired session or a dropped connection, and these
	// buttons are the only thing on this screen that would otherwise say so.
	let failed = $state(false);

	async function run(action: () => Promise<unknown>) {
		failed = false;

		try {
			await action();
			return true;
		} catch {
			failed = true;
			return false;
		}
	}

	// The row moving is silent for anyone who cannot see it, so the new position
	// is announced instead.
	let announcement = $state('');

	const arrowId = (id: string, direction: Direction) => `move-${direction}-${id}`;

	async function move(id: string, name: string, index: number, direction: Direction) {
		if (!(await run(() => moveInstructor({ id, direction })))) return;

		const position = direction === 'up' ? index - 1 : index + 1;
		const other: Direction = direction === 'up' ? 'down' : 'up';

		// Focus is put back by hand because the arrow that was pressed is disabled
		// once the row reaches an end of the list, and a disabled button hands
		// focus back to the document.
		const atEnd = direction === 'up' ? position === 0 : position === instructors.length - 1;

		await tick();
		document.getElementById(arrowId(id, atEnd ? other : direction))?.focus();

		announcement = m.admin_instructors_moved({
			name,
			position: position + 1,
			total: instructors.length
		});
	}
</script>

<AdminPage title={m.admin_instructors_title()} intro={m.admin_instructors_intro()}>
	{#snippet actions()}
		<a
			href={localizeHref('/admin/instruktorzy/nowy')}
			class="btn btn-yellow px-6 py-3 text-[0.9rem]"
		>
			{m.admin_instructors_new()}
		</a>
	{/snippet}

	<div class="flex flex-col gap-5">
		<!-- Rendered even when empty: a live region only announces what changes
		     inside it, not a region that appears with its text already in place. -->
		<p class="sr-only" role="status">{announcement}</p>

		{#if failed}
			<p
				class="border-l-[3px] border-red bg-red/20 px-4 py-3 text-[0.85rem] text-paper"
				role="alert"
			>
				{m.admin_error_generic()}
			</p>
		{/if}

		{#if instructors.length === 0}
			<AdminEmpty text={m.admin_instructors_empty()} />
		{:else}
			<LocaleTabs>
				{#snippet children(locale)}
					<ul class="flex flex-col gap-px">
						{#each instructors as row, index (row.id)}
							<!-- The left edge and the photo marker carry the accent the card
							     will take on the public grid. -->
							{@const preview = accentPreview(row)}
							{@const translation = translationOf(row, locale)}
							{@const name = translation?.name || m.admin_locale_missing()}

							<li
								class="flex flex-wrap items-center gap-4 border-l-[3px] {preview.edge} bg-blue px-4 py-3"
							>
								<!-- A marker, not a thumbnail: the list never loads the photos
								     themselves, only whether one is set. -->
								<span
									role="img"
									aria-label={row.hasPhoto
										? m.admin_instructors_photo()
										: m.admin_instructors_photo_missing()}
									title={row.hasPhoto
										? m.admin_instructors_photo()
										: m.admin_instructors_photo_missing()}
									class="size-11 shrink-0 {row.hasPhoto
										? preview.marker
										: 'border border-dashed border-white/25'}"
								></span>

								<div class="min-w-0 flex-1 basis-40">
									{#if translation?.name}
										<p class="font-display text-[1.05rem] font-bold text-paper">
											{translation.name}
										</p>
									{:else}
										<p class="font-display text-[1.05rem] text-paper/40 italic">
											{m.admin_locale_missing()}
										</p>
									{/if}

									{#if translation?.badge}
										<p class="eyebrow mt-1 text-[0.72rem] text-paper/60">{translation.badge}</p>
									{/if}
								</div>

								<button
									type="button"
									onclick={() =>
										run(() => setInstructorPublished({ id: row.id, published: !row.published }))}
									aria-pressed={row.published}
									class="eyebrow border-2 px-3 py-1 text-[0.7rem] whitespace-nowrap transition-colors
										{row.published
										? 'border-yellow text-yellow'
										: 'border-white/25 text-paper/55 hover:border-white/45'}"
								>
									{row.published ? m.admin_visible() : m.admin_hidden()}
								</button>

								<div class="flex gap-1">
									<button
										type="button"
										id={arrowId(row.id, 'up')}
										onclick={() => move(row.id, name, index, 'up')}
										disabled={index === 0}
										aria-label={m.admin_move_up()}
										title={m.admin_move_up()}
										class="border border-white/20 px-[0.6rem] py-1 text-paper/75 transition-colors hover:border-yellow hover:text-yellow disabled:cursor-not-allowed disabled:opacity-30"
									>
										↑
									</button>
									<button
										type="button"
										id={arrowId(row.id, 'down')}
										onclick={() => move(row.id, name, index, 'down')}
										disabled={index === instructors.length - 1}
										aria-label={m.admin_move_down()}
										title={m.admin_move_down()}
										class="border border-white/20 px-[0.6rem] py-1 text-paper/75 transition-colors hover:border-yellow hover:text-yellow disabled:cursor-not-allowed disabled:opacity-30"
									>
										↓
									</button>
								</div>

								<a
									href={localizeHref(`/admin/instruktorzy/${row.id}`)}
									class="text-[0.85rem] text-yellow underline underline-offset-4"
								>
									{m.admin_edit()}
								</a>
							</li>
						{/each}
					</ul>
				{/snippet}
			</LocaleTabs>
		{/if}
	</div>
</AdminPage>
