<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { getLocale, localizeHref } from '#lib/paraglide/runtime';
	import { contentLocales, localeName } from '#lib/locales';
	import {
		deleteInstructor,
		getInstructorForAdmin,
		saveInstructor
	} from '#lib/remote/admin-instructors.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { MAX_PHOTO_BYTES, downscalePhoto, photoByteLength } from '#lib/photo';
	import * as m from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	// `params` rather than `page.params`: only the route's own type knows that
	// `id` is always present here.
	const { params }: PageProps = $props();

	// `/admin/instruktorzy/nowy` is the create form; anything else is a row's id.
	const isNew = $derived(params.id === 'nowy');

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
		await goto(localizeHref('/admin/instruktorzy'));
	}
</script>

<AdminPage title={isNew ? m.admin_instructors_new() : m.admin_instructors_edit()}>
	{#snippet actions()}
		<a
			href={localizeHref('/admin/instruktorzy')}
			class="text-[0.85rem] text-paper/65 transition-colors hover:text-paper"
		>
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

		<div class="grid items-start gap-6 md:grid-cols-[300px_1fr]">
			<AdminCard>
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
									class="flex aspect-square w-full items-center justify-center border border-dashed border-white/20 text-center text-[0.8rem] text-paper/45"
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
								class="btn btn-ghost py-3 text-[0.85rem]"
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
									class="text-[0.82rem] text-yellow underline underline-offset-4"
								>
									{m.admin_instructors_photo_remove()}
								</button>
							{/if}
						</div>
					{/snippet}
				</AdminField>
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
			<label class="flex cursor-pointer items-center gap-3 text-[0.9rem] text-paper/85">
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
						class="border-2 border-red px-6 py-3 font-display text-[0.9rem] font-bold tracking-[0.04em] text-paper transition-colors hover:bg-red disabled:cursor-not-allowed disabled:opacity-55"
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
