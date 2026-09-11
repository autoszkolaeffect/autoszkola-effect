<script lang="ts">
	import { ArrowDown, ArrowUp } from '@lucide/svelte';
	import {
		deleteCourseOption,
		deletePhone,
		getContactForAdmin,
		moveCourseOption,
		movePhone,
		saveContactSettings,
		saveCourseOption,
		savePhone,
		type AdminContact
	} from '#lib/remote/admin-contact.remote';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import AdminField from '#lib/components/admin/AdminField.svelte';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import LocaleTabs from '#lib/components/admin/LocaleTabs.svelte';
	import { indexOfLocale } from '#lib/locales';
	import * as m from '#lib/paraglide/messages';

	type ContactText = AdminContact['text'][string];

	type TextField = {
		/** Named rather than `string`, so the field it binds to is the field it reads. */
		key: Exclude<keyof ContactText, 'locale'>;
		label: string;
		read: (text: ContactText) => string;
		hint?: string;
		rows?: number;
	};

	// State declared above the `await` below is initialised once, so it survives
	// the query refreshing after every save.
	let typedMapQuery = $state<string | null>(null);
	let previewMapQuery = $state<string | null>(null);
	let pickedPrimaryPhone = $state<string | null>(null);

	// Every change of `src` is a request to Google, so the preview follows the
	// typing rather than each keystroke.
	$effect(() => {
		const value = typedMapQuery;
		if (value === null) return;

		const timer = setTimeout(() => (previewMapQuery = value), 400);
		return () => clearTimeout(timer);
	});

	const contactQuery = getContactForAdmin();
	const loaded = await contactQuery;
	// The `await` resolves once; `current` is the same data as the mutations
	// below refresh it.
	const contact = $derived(contactQuery.current ?? loaded);

	const settings = saveContactSettings.fields;
	const savingSettings = $derived(saveContactSettings.pending > 0);

	// The pick stands until the row carrying it is saved, but only while that row
	// is still there: deleting it hands the group back to whichever phone the
	// server promoted in its place.
	const primaryPhoneId = $derived(
		contact.phones.find((phone) => phone.id === pickedPrimaryPhone)?.id ??
			contact.phones.find((phone) => phone.primary)?.id ??
			''
	);

	const mapPreview = $derived(mapEmbedUrl(previewMapQuery ?? contact.mapQuery));

	const pageHeadingFields: TextField[] = [
		{ key: 'pageTitle', label: m.admin_contact_page_title(), read: (text) => text.pageTitle },
		{
			key: 'pageIntro',
			label: m.admin_contact_page_intro(),
			read: (text) => text.pageIntro,
			rows: 3
		}
	];

	const sectionHeadingFields: TextField[] = [
		{
			key: 'phonesHeading',
			label: m.admin_contact_phones_heading(),
			read: (text) => text.phonesHeading
		},
		{
			key: 'addressHeading',
			label: m.admin_contact_address_heading(),
			read: (text) => text.addressHeading
		},
		{ key: 'formHeading', label: m.admin_contact_form_heading(), read: (text) => text.formHeading }
	];

	const addressFields: TextField[] = [
		{ key: 'companyName', label: m.admin_contact_company_name(), read: (text) => text.companyName },
		{
			key: 'addressLine1',
			label: m.admin_contact_address_line1(),
			read: (text) => text.addressLine1
		},
		{
			key: 'addressLine2',
			label: m.admin_contact_address_line2(),
			read: (text) => text.addressLine2
		},
		{
			key: 'openingHours',
			label: m.admin_contact_opening_hours(),
			read: (text) => text.openingHours
		},
		{
			key: 'footerAddress',
			label: m.admin_contact_footer_address(),
			hint: m.admin_contact_footer_address_hint(),
			read: (text) => text.footerAddress
		}
	];

	/**
	 * Where a locale sits in `contentLocales`. The per-locale form fields are
	 * indexed by that position rather than keyed by the locale tag, because a
	 * field name is parsed as a JavaScript path and a tag such as `en-GB` is not
	 * one. The data coming back from the query stays keyed by tag.
	 */

	/**
	 * Google's keyless embed - the same URL `getSiteContact` builds, so what the
	 * preview shows is what the page will show.
	 */
	function mapEmbedUrl(place: string): string {
		const query = place.trim();
		if (!query) return '';

		return `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=pl&z=16&output=embed`;
	}

	function confirmDelete(remove: () => Promise<unknown>) {
		if (confirm(m.admin_delete_confirm())) remove();
	}

	const rowButton =
		'inline-flex items-center justify-center border-2 border-white/25 px-tag py-1 text-label leading-none text-paper/75 transition-colors hover:border-white/50 hover:text-paper disabled:opacity-35';
	const dangerButton =
		'border-2 border-red px-3 py-1 text-meta leading-none text-paper transition-colors hover:bg-red';
	const rowSubmit = 'btn btn-red px-5 py-2 text-caption';
</script>

<AdminPage title={m.admin_contact_title()} intro={m.admin_contact_intro()}>
	<div class="flex flex-col gap-6">
		<!-- Singleton settings: the translated text, then the two shared values -->
		<form {...saveContactSettings} class="flex flex-col gap-6">
			<LocaleTabs>
				{#snippet children(locale)}
					<div class="flex flex-col gap-6">
						<AdminCard title={m.admin_contact_page_heading()}>
							{@render textFields(locale, pageHeadingFields)}
						</AdminCard>

						<AdminCard title={m.admin_contact_headings()}>
							{@render textFields(locale, sectionHeadingFields)}
						</AdminCard>

						<AdminCard title={m.admin_contact_address()}>
							{@render textFields(locale, addressFields)}
						</AdminCard>
					</div>
				{/snippet}
			</LocaleTabs>

			<AdminCard>
				<AdminField label={m.admin_contact_email()} issues={settings.email.issues()}>
					{#snippet children(id, aria)}
						<input {id} {...settings.email.as('email', contact.email)} {...aria} class="field" />
					{/snippet}
				</AdminField>
			</AdminCard>

			<AdminCard title={m.admin_contact_map()}>
				<div class="flex flex-col gap-5">
					<AdminField
						label={m.admin_contact_map_query()}
						hint={m.admin_contact_map_query_hint()}
						issues={settings.mapQuery.issues()}
					>
						{#snippet children(id, aria)}
							<input
								{id}
								{...settings.mapQuery.as('text', contact.mapQuery)}
								{...aria}
								oninput={(event) => (typedMapQuery = event.currentTarget.value)}
								class="field"
							/>
						{/snippet}
					</AdminField>

					<AdminField
						label={m.admin_contact_map_embed()}
						hint={m.admin_contact_map_embed_hint()}
						issues={settings.mapEmbedUrl.issues()}
					>
						{#snippet children(id, aria)}
							<input
								{id}
								{...settings.mapEmbedUrl.as('url', contact.mapEmbedUrl)}
								{...aria}
								class="field"
							/>
						{/snippet}
					</AdminField>

					<div>
						<p class="eyebrow mb-2 text-eyebrow text-paper/60">{m.admin_contact_map_preview()}</p>

						{#if mapPreview}
							<div class="overflow-hidden border-2 border-navy">
								<iframe
									src={mapPreview}
									title={m.admin_contact_map_preview()}
									loading="lazy"
									referrerpolicy="no-referrer-when-downgrade"
									class="block aspect-video w-full border-0"
								></iframe>
							</div>
						{:else}
							<AdminEmpty text={m.admin_contact_map_preview_empty()} />
						{/if}
					</div>
				</div>
			</AdminCard>

			<div class="flex flex-wrap items-center gap-4">
				<button type="submit" class="btn btn-red" disabled={savingSettings}>
					{savingSettings ? m.admin_saving() : m.admin_save()}
				</button>

				{#if saveContactSettings.result?.saved}
					<p class="text-caption text-yellow" role="status">{m.admin_saved()}</p>
				{/if}
			</div>
		</form>

		<!-- Phones ---------------------------------------------------------->
		<AdminCard title={m.admin_contact_phones()}>
			<LocaleTabs>
				{#snippet children(locale)}
					{@const localeIndex = indexOfLocale(locale)}
					{#if contact.phones.length === 0}
						<AdminEmpty text={m.admin_contact_phones_empty()} />
					{:else}
						<!-- One radio group over the whole list. Radios only group with the
						     ones that share their form owner and every row posts its own
						     form, so they sit outside the row forms - nothing submits them,
						     and which row is primary travels as the hidden field of the row
						     being saved. -->
						<fieldset class="min-w-0">
							<legend class="eyebrow mb-3 text-eyebrow text-paper/60">
								{m.admin_contact_phone_primary()}
							</legend>

							<div class="flex flex-col gap-3">
								{#each contact.phones as phone, index (phone.id)}
									{@const row = savePhone.for(phone.id)}
									{@const isPrimary = primaryPhoneId === phone.id}
									<div class="border-l-3 border-red bg-navy p-4">
										<label class="mb-4 flex items-center gap-2 text-caption text-paper/75">
											<input
												type="radio"
												name="primary-phone"
												value={phone.id}
												checked={isPrimary}
												onchange={() => (pickedPrimaryPhone = phone.id)}
												class="size-4 border-white/25 bg-navy text-red"
											/>
											{phone.number}
										</label>

										<form {...row}>
											<input {...row.fields.id.as('hidden', phone.id)} />
											<input {...row.fields.primary.as('hidden', isPrimary)} />

											<div class="grid gap-4 md:grid-cols-2">
												<AdminField
													label={m.admin_contact_phone_label()}
													issues={row.fields.labels[localeIndex].issues()}
												>
													{#snippet children(id, aria)}
														<input
															{id}
															{...row.fields.labels[localeIndex].as('text', phone.labels[locale])}
															{...aria}
															class="field"
														/>
													{/snippet}
												</AdminField>

												<AdminField
													label={m.admin_contact_phone_number()}
													issues={row.fields.number.issues()}
												>
													{#snippet children(id, aria)}
														<input
															{id}
															{...row.fields.number.as('tel', phone.number)}
															{...aria}
															class="field"
														/>
													{/snippet}
												</AdminField>
											</div>

											<div class="mt-4 flex flex-wrap items-center justify-end gap-2">
												<button
													type="button"
													onclick={() => movePhone({ id: phone.id, direction: 'up' })}
													disabled={index === 0}
													aria-label={m.admin_move_up()}
													class={rowButton}
												>
													<ArrowUp class="size-4" aria-hidden="true" />
												</button>
												<button
													type="button"
													onclick={() => movePhone({ id: phone.id, direction: 'down' })}
													disabled={index === contact.phones.length - 1}
													aria-label={m.admin_move_down()}
													class={rowButton}
												>
													<ArrowDown class="size-4" aria-hidden="true" />
												</button>
												<button
													type="button"
													onclick={() => confirmDelete(() => deletePhone(phone.id))}
													class={dangerButton}
												>
													{m.admin_delete()}
												</button>
												<button type="submit" class={rowSubmit}>{m.admin_save()}</button>
											</div>
										</form>
									</div>
								{/each}
							</div>
						</fieldset>
					{/if}

					<form {...savePhone} class="mt-6 border-t border-white/12 pt-6">
						<div class="grid gap-4 md:grid-cols-2">
							<AdminField
								label={m.admin_contact_phone_label()}
								issues={savePhone.fields.labels[localeIndex].issues()}
							>
								{#snippet children(id, aria)}
									<input
										{id}
										{...savePhone.fields.labels[localeIndex].as('text')}
										{...aria}
										class="field"
									/>
								{/snippet}
							</AdminField>

							<AdminField
								label={m.admin_contact_phone_number()}
								issues={savePhone.fields.number.issues()}
							>
								{#snippet children(id, aria)}
									<input {id} {...savePhone.fields.number.as('tel')} {...aria} class="field" />
								{/snippet}
							</AdminField>
						</div>

						<button type="submit" class="{rowSubmit} mt-4">{m.admin_contact_phone_add()}</button>
					</form>
				{/snippet}
			</LocaleTabs>
		</AdminCard>

		<!-- Course options -------------------------------------------------->
		<AdminCard title={m.admin_contact_courses()}>
			<p class="mb-5 text-caption leading-hint text-paper/65">
				{m.admin_contact_courses_intro()}
			</p>

			<LocaleTabs>
				{#snippet children(locale)}
					{@const localeIndex = indexOfLocale(locale)}
					<div class="flex flex-col gap-3">
						{#each contact.courses as course, index (course.id)}
							{@const row = saveCourseOption.for(course.id)}
							<form {...row} class="border-l-3 border-yellow bg-navy p-4">
								<input {...row.fields.id.as('hidden', course.id)} />

								<div class="grid gap-4 md:grid-cols-2">
									<AdminField
										label={m.admin_contact_course_value()}
										hint={m.admin_contact_course_value_hint()}
										issues={row.fields.value.issues()}
									>
										{#snippet children(id, aria)}
											<input
												{id}
												{...row.fields.value.as('text', course.value)}
												{...aria}
												class="field"
											/>
										{/snippet}
									</AdminField>

									<AdminField
										label={m.admin_contact_course_label()}
										issues={row.fields.labels[localeIndex].issues()}
									>
										{#snippet children(id, aria)}
											<input
												{id}
												{...row.fields.labels[localeIndex].as('text', course.labels[locale])}
												{...aria}
												class="field"
											/>
										{/snippet}
									</AdminField>
								</div>

								<div class="mt-4 flex flex-wrap items-center justify-end gap-2">
									<button
										type="button"
										onclick={() => moveCourseOption({ id: course.id, direction: 'up' })}
										disabled={index === 0}
										aria-label={m.admin_move_up()}
										class={rowButton}
									>
										<ArrowUp class="size-4" aria-hidden="true" />
									</button>
									<button
										type="button"
										onclick={() => moveCourseOption({ id: course.id, direction: 'down' })}
										disabled={index === contact.courses.length - 1}
										aria-label={m.admin_move_down()}
										class={rowButton}
									>
										<ArrowDown class="size-4" aria-hidden="true" />
									</button>
									<button
										type="button"
										onclick={() => confirmDelete(() => deleteCourseOption(course.id))}
										class={dangerButton}
									>
										{m.admin_delete()}
									</button>
									<button type="submit" class={rowSubmit}>{m.admin_save()}</button>
								</div>
							</form>
						{:else}
							<AdminEmpty text={m.admin_contact_courses_empty()} />
						{/each}
					</div>

					<form {...saveCourseOption} class="mt-6 border-t border-white/12 pt-6">
						<div class="grid gap-4 md:grid-cols-2">
							<AdminField
								label={m.admin_contact_course_value()}
								hint={m.admin_contact_course_value_hint()}
								issues={saveCourseOption.fields.value.issues()}
							>
								{#snippet children(id, aria)}
									<input
										{id}
										{...saveCourseOption.fields.value.as('text')}
										{...aria}
										class="field"
									/>
								{/snippet}
							</AdminField>

							<AdminField
								label={m.admin_contact_course_label()}
								issues={saveCourseOption.fields.labels[localeIndex].issues()}
							>
								{#snippet children(id, aria)}
									<input
										{id}
										{...saveCourseOption.fields.labels[localeIndex].as('text')}
										{...aria}
										class="field"
									/>
								{/snippet}
							</AdminField>
						</div>

						<button type="submit" class="{rowSubmit} mt-4">{m.admin_contact_course_add()}</button>
					</form>
				{/snippet}
			</LocaleTabs>
		</AdminCard>
	</div>
</AdminPage>

{#snippet textFields(locale: string, fields: TextField[])}
	<div class="flex flex-col gap-5">
		{#each fields as field (field.key)}
			{@const bound = settings.text[indexOfLocale(locale)][field.key]}
			<AdminField label={field.label} hint={field.hint} issues={bound.issues()}>
				{#snippet children(id, aria)}
					{#if field.rows}
						<textarea
							{id}
							{...bound.as('text', field.read(contact.text[locale]))}
							{...aria}
							rows={field.rows}
							class="field"></textarea>
					{:else}
						<input
							{id}
							{...bound.as('text', field.read(contact.text[locale]))}
							{...aria}
							class="field"
						/>
					{/if}
				{/snippet}
			</AdminField>
		{/each}
	</div>
{/snippet}
