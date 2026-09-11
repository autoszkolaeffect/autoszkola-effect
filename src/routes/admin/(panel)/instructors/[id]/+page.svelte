<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { error } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { contentLocales, localeName } from '#lib/locales';
	import {
		deleteInstructor,
		getInstructorForAdmin,
		listInstructorsForAdmin,
		saveInstructor
	} from '#lib/remote/admin-instructors.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { MAX_PHOTO_BYTES, downscalePhoto, photoByteLength } from '#lib/photo';
	import { accentForeground, accentMeetsAA, instructorAccentHex, isAccentHex } from '#lib/accents';
	import * as m from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	// `params` rather than `page.params`: only the route's own type knows that
	// `id` is always present here.
	const { params }: PageProps = $props();

	// `/admin/instructors/new` is the create form; anything else is a row's id.
	const isNew = $derived(params.id === 'new');

	// Derived rather than awaited once, so moving between two instructors re-reads
	// instead of keeping the first one on screen. `error` returns `never`, which
	// both narrows the value and turns an unknown id into a real 404.
	const instructor = $derived(
		isNew ? null : ((await getInstructorForAdmin(params.id)) ?? error(404, m.error_404_title()))
	);

	// One form instance per id, so what is typed into one instructor's form never
	// resurfaces in another's.
	const save = $derived(saveInstructor.for(params.id));
	const fields = $derived(save.fields);

	const saving = $derived(save.pending > 0);
	const removing = $derived(deleteInstructor.pending > 0);

	// `null` until a photo is picked or removed here, at which point it takes over
	// from whatever is stored.
	let picked = $state<string | null>(null);
	let photoError = $state('');

	// The file input is driven by the visible button rather than a label, so that
	// what a keyboard user focuses is the control they can actually see.
	let fileInput = $state<HTMLInputElement | null>(null);

	const photo = $derived(picked ?? instructor?.photo ?? '');

	const photoAction = $derived(
		photo ? m.admin_instructors_photo_replace() : m.admin_instructors_photo_choose()
	);

	const photoIssues = $derived([
		...(fields.photo.issues() ?? []),
		...(photoError ? [{ message: photoError }] : [])
	]);

	// The same three states the photo has, for the same reason: `null` while the
	// control is untouched, a hex once one is chosen, and `''` for a colour put
	// back to automatic - which `null` cannot say, because the stored colour
	// would show through it again.
	let pickedAccent = $state<string | null>(null);

	const accent = $derived(pickedAccent ?? instructor?.accent ?? '');

	// What "automatic" currently means. An existing instructor is handed the
	// colour of its own position by the query; a new one is not in the grid yet,
	// but `saveInstructor` puts it at the end, so the colour it will take there is
	// the one after however many published instructors it lines up behind. The
	// list is only fetched on that branch - the edit path already knows.
	const autoAccent = $derived(
		instructor
			? instructor.autoAccent
			: instructorAccentHex(
					null,
					(await listInstructorsForAdmin()).filter((row) => row.published).length
				)
	);

	// A colour input has no way to display "unset", so on automatic it shows the
	// colour the card takes without one - the line under it is what says the
	// accent is automatic rather than that particular hex. A stored value CSS
	// would reject falls here too; it stays in the field, where saving flags it,
	// instead of being silently swallowed by the picker.
	const swatch = $derived(isAccentHex(accent) ? accent : autoAccent);

	// Only a colour chosen by hand can miss AA: on automatic the card takes one of
	// the four palette colours and all four clear it. No guard for that is needed
	// here, because `accentMeetsAA` also passes anything that is not a usable hex,
	// which is exactly when the picker is showing `autoAccent` instead.
	const accentBelowAA = $derived(!accentMeetsAA(accent));

	async function choosePhoto(input: HTMLInputElement) {
		const file = input.files?.[0];
		// Cleared so that picking the same file again still fires a change event.
		input.value = '';
		if (!file) return;

		photoError = '';

		if (!file.type.startsWith('image/')) {
			photoError = m.admin_instructors_photo_invalid();
			return;
		}

		try {
			const downscaled = await downscalePhoto(file);

			// The browser has already capped the longest edge, so this only catches
			// the pathological case of a photo that stays huge anyway.
			if (photoByteLength(downscaled) > MAX_PHOTO_BYTES) {
				photoError = m.admin_instructors_photo_too_large();
				return;
			}

			picked = downscaled;
		} catch {
			// A file the browser cannot decode is not a usable image, whatever its
			// declared type claimed.
			photoError = m.admin_instructors_photo_invalid();
		}
	}

	async function remove() {
		const current = instructor;
		if (!current || !confirm(m.admin_delete_confirm())) return;

		await deleteInstructor(current.id);
		await goto(localizeHref('/admin/instructors'));
	}
</script>

<AdminPage title={isNew ? m.admin_instructors_new() : m.admin_instructors_edit()}>
	{#snippet actions()}
		<a
			href={localizeHref('/admin/instructors')}
			class="inline-flex items-center gap-1 text-caption text-paper/65 transition-colors hover:text-paper"
		>
			<ArrowLeft class="size-4" aria-hidden="true" />
			{m.admin_back_to_list()}
		</a>
	{/snippet}

	<form
		{...save.enhance(async (instance) => {
			// A successful save redirects to the list, so this form is gone before
			// the field state would be reset for us. Clearing it by hand keeps the
			// next visit from restoring what was just saved.
			if (await instance.submit()) instance.fields.set({});
		})}
		class="flex flex-col gap-6"
	>
		<input {...fields.id.as('hidden', instructor?.id ?? '')} />
		<input {...fields.locale.as('hidden', getLocale())} />
		<input {...fields.photo.as('hidden', photo)} />
		<input {...fields.accent.as('hidden', accent)} />

		<div class="grid items-start gap-6 md:grid-editor-aside">
			<AdminCard>
				<div class="flex flex-col gap-5">
					<AdminField
						label={m.admin_instructors_photo()}
						hint={m.admin_instructors_photo_hint()}
						issues={photoIssues}
					>
						{#snippet children(id, aria)}
							<div class="flex flex-col gap-3">
								{#if photo}
									<img
										src={photo}
										alt=""
										width="300"
										height="300"
										class="block aspect-square w-full object-cover"
									/>
								{:else}
									<p
										class="flex aspect-square w-full items-center justify-center border border-dashed border-white/20 text-center text-note text-paper/45"
									>
										{m.admin_instructors_photo_missing()}
									</p>
								{/if}

								<input
									bind:this={fileInput}
									type="file"
									accept="image/*"
									tabindex={-1}
									aria-hidden="true"
									class="sr-only"
									onchange={(event) => choosePhoto(event.currentTarget)}
								/>
								<!-- Named explicitly: the field's own `<label for>` would otherwise
								     take over the accessible name, leaving voice control with no way
								     to say what is written on the button. -->
								<button
									{id}
									{...aria}
									type="button"
									aria-label={photoAction}
									onclick={() => fileInput?.click()}
									class="btn btn-ghost py-3 text-caption"
								>
									{photoAction}
								</button>

								{#if photo}
									<button
										type="button"
										onclick={() => {
											picked = '';
											photoError = '';
										}}
										class="text-meta text-yellow underline underline-offset-4"
									>
										{m.admin_instructors_photo_remove()}
									</button>
								{/if}
							</div>
						{/snippet}
					</AdminField>

					<AdminField
						label={m.admin_instructors_accent()}
						hint={m.admin_instructors_accent_hint()}
						issues={fields.accent.issues()}
					>
						{#snippet children(id, aria)}
							<div
								class="flex flex-col gap-3"
								style:--accent={swatch}
								style:--accent-on={accentForeground(swatch)}
							>
								<!-- A real form control with a real label, unlike the file input
								     above, so it is the thing the label points at. It carries no
								     `name`: the hidden field at the top of the form is what gets
								     submitted, because "automatic" has no colour to send. -->
								<input
									{id}
									{...aria}
									type="color"
									bind:value={() => swatch, (value) => (pickedAccent = value)}
									class="field h-11 cursor-pointer p-1"
								/>

								<div class="flex flex-wrap items-baseline justify-between gap-2">
									<p class="text-note text-paper/60">
										{accent || m.admin_instructors_accent_auto()}
									</p>

									{#if accent}
										<button
											type="button"
											onclick={() => (pickedAccent = '')}
											class="text-meta text-yellow underline underline-offset-4"
										>
											{m.admin_instructors_accent_reset()}
										</button>
									{/if}
								</div>

								<!-- The two places the card spends its accent, so a colour that
								     leaves the badge unreadable shows that here rather than on the
								     public grid. Decorative: the hex, or the automatic line, has
								     already said what is set. -->
								<div aria-hidden="true" class="bg-navy">
									<div class="p-3">
										<span
											class="inline-block bg-accent px-tag py-1 text-badge font-bold tracking-widest text-on-accent uppercase"
										>
											{m.admin_instructors_badge()}
										</span>
									</div>
									<div class="h-1 w-full bg-accent"></div>
								</div>

								{#if accentBelowAA}
									<!-- The panel's advisory tone - yellow edge on navy - rather than
									     the field's red one, because the colour saves either way: the
									     badge is simply below the 4.5:1 the rest of the site holds to.
									     Outside `issues` for the same reason, so nothing marks the
									     picker invalid. -->
									<p
										role="status"
										class="border-l-3 border-yellow bg-navy px-3 py-2 text-note leading-normal text-paper"
									>
										{m.admin_instructors_accent_contrast()}
									</p>
								{/if}
							</div>
						{/snippet}
					</AdminField>
				</div>
			</AdminCard>

			<AdminCard>
				<LocaleTabs>
					{#snippet children(active)}
						{#each contentLocales as locale, index (locale)}
							<!-- Every locale stays mounted and is only hidden, because an
							     unmounted input submits nothing - switching tabs must not
							     drop what was written in another language. -->
							<div hidden={locale !== active} class="flex flex-col gap-5">
								<input {...fields.translations[index].locale.as('hidden', locale)} />

								<h2 class="sr-only">
									{m.admin_locale_section({ locale: localeName(locale) })}
								</h2>

								<AdminField
									label={m.admin_instructors_name()}
									issues={fields.translations[index].name.issues()}
								>
									{#snippet children(id, aria)}
										<input
											{id}
											{...fields.translations[index].name.as(
												'text',
												instructor?.translations[locale].name ?? ''
											)}
											{...aria}
											class="field"
										/>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_instructors_badge()}
									hint={m.admin_instructors_badge_hint()}
									issues={fields.translations[index].badge.issues()}
								>
									{#snippet children(id, aria)}
										<input
											{id}
											{...fields.translations[index].badge.as(
												'text',
												instructor?.translations[locale].badge ?? ''
											)}
											{...aria}
											class="field"
										/>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_instructors_experience()}
									hint={m.admin_instructors_experience_hint()}
									issues={fields.translations[index].experience.issues()}
								>
									{#snippet children(id, aria)}
										<input
											{id}
											{...fields.translations[index].experience.as(
												'text',
												instructor?.translations[locale].experience ?? ''
											)}
											{...aria}
											class="field"
										/>
									{/snippet}
								</AdminField>

								<AdminField
									label={m.admin_instructors_bio()}
									issues={fields.translations[index].bio.issues()}
								>
									{#snippet children(id, aria)}
										<textarea
											{id}
											rows="7"
											{...fields.translations[index].bio.as(
												'text',
												instructor?.translations[locale].bio ?? ''
											)}
											{...aria}
											class="field"></textarea>
									{/snippet}
								</AdminField>
							</div>
						{/each}
					{/snippet}
				</LocaleTabs>
			</AdminCard>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-4">
			<label class="flex cursor-pointer items-center gap-3 text-label text-paper/85">
				<input
					{...fields.published.as('checkbox', instructor?.published ?? true)}
					class="size-4 border-white/25 bg-navy text-yellow"
				/>
				{m.admin_visible()}
			</label>

			<div class="flex flex-wrap items-center gap-3">
				{#if !isNew}
					<button
						type="button"
						onclick={remove}
						disabled={removing}
						class="border-2 border-red px-6 py-3 font-display text-label font-bold tracking-button text-paper transition-colors hover:bg-red disabled:cursor-not-allowed disabled:opacity-55"
					>
						{removing ? m.admin_deleting() : m.admin_delete()}
					</button>
				{/if}

				<button type="submit" disabled={saving} class="btn btn-yellow py-3">
					{saving ? m.admin_saving() : m.admin_save()}
				</button>
			</div>
		</div>
	</form>
</AdminPage>
