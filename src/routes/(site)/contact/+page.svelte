<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import type { RemoteFormIssue } from '$app/server';
	import { page } from '$app/state';
	import { getLocale } from '#lib/paraglide/runtime';
	import { getSiteContact, submitContactForm } from '#lib/remote/site.remote';
	import Seo from '#lib/components/Seo.svelte';
	import TurnstileWidget from '#lib/components/TurnstileWidget.svelte';
	import { telHref } from '#lib/format';
	import { metaDescription, ogImageHref, pageTitle } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';

	const locale = getLocale();

	// The heading, the intro and every label on this page are admin-editable, so
	// they come from the database rather than the message catalogue.
	const contact = await getSiteContact(locale);

	// Those settings start out empty, and an empty heading is worse than a generic
	// one: each falls back to the catalogue, and anything with nothing behind it
	// is left out entirely rather than rendered as a blank shell.
	const heading = contact.pageTitle || m.nav_contact();
	const phonesHeading = contact.phonesHeading || m.contact_phones_heading();
	const addressHeading = contact.addressHeading || m.contact_address_heading();
	const formHeading = contact.formHeading || m.contact_form_heading();

	const hasAddress = Boolean(
		contact.companyName ||
		contact.addressLine1 ||
		contact.addressLine2 ||
		contact.openingHours ||
		contact.email
	);

	const fields = submitContactForm.fields;

	let captcha: ReturnType<typeof TurnstileWidget> | undefined = $state();
	let successPanel: HTMLDivElement | undefined = $state();

	// A result outlives the submission that produced it, so the thank-you panel is
	// dismissed by remembering which result the visitor has already seen.
	let dismissed: typeof submitContactForm.result = $state();

	const result = $derived(submitContactForm.result);
	const sent = $derived(result?.ok === true && result !== dismissed);
	const pending = $derived(submitContactForm.pending > 0);

	const issues = $derived({
		name: fields.name.issues(),
		email: fields.email.issues(),
		phone: fields.phone.issues(),
		course: fields.course.issues(),
		message: fields.message.issues(),
		captcha: fields.turnstileToken.issues()
	});

	$effect(() => {
		// A Turnstile token is single-use, so a rejected submission needs a fresh
		// one before the visitor can try again.
		if (result && !result.ok) captcha?.reset();
	});

	$effect(() => {
		// The form the visitor was working in is replaced by the thank-you panel, so
		// without this focus falls back to <body> - the confirmation goes unread and
		// the next Tab starts again from the top of the page.
		if (sent) successPanel?.focus();
	});

	function sendAnother() {
		dismissed = result;
		// The form keeps the submitted values around so a failed submission can
		// restore them; this visitor is starting a new message.
		fields.set({});
	}
</script>

<Seo
	title={pageTitle(heading)}
	description={metaDescription(contact.pageIntro || m.site_description())}
	path="/contact"
	image={ogImageHref(page.url.origin, locale, 'contact', contact.updatedAt)}
/>

<!-- Header band ------------------------------------------------------------->
<section class="border-b-4 border-red bg-blue px-6 pt-16 pb-12">
	<div class="mx-auto max-w-225">
		<div class="section-rule bg-red"></div>
		<h1 class="mb-4 text-page font-bold text-paper">
			{heading}
		</h1>
		{#if contact.pageIntro}
			<p class="max-w-145 text-body-lg leading-body text-paper/80">
				{contact.pageIntro}
			</p>
		{/if}
	</div>
</section>

<div class="mx-auto max-w-275 px-6 py-16">
	<div class="grid grid-cards items-start gap-12">
		<!-- Phones, address, map ---------------------------------------------->
		<div>
			{#if contact.phones.length > 0}
				<h2 class="mb-5 text-panel font-bold text-yellow">{phonesHeading}</h2>

				{#each contact.phones as phone (phone.id)}
					<div
						class="mb-2 flex items-center justify-between gap-4 border-l-3 border-red bg-blue px-4 py-roomy"
					>
						<span class="eyebrow text-caption text-paper/65">{phone.label}</span>
						<a href={telHref(phone.number)} class="font-display text-body-lg font-bold text-paper">
							{phone.number}
						</a>
					</div>
				{/each}
			{/if}

			{#if hasAddress}
				<h2
					class="mb-5 text-panel font-bold text-yellow {contact.phones.length > 0 ? 'mt-10' : ''}"
				>
					{addressHeading}
				</h2>

				<address
					class="border-l-3 border-yellow bg-blue p-5 leading-address text-paper/85 not-italic"
				>
					{#if contact.companyName}
						<strong class="mb-1 block text-paper">{contact.companyName}</strong>
					{/if}

					<!-- Blocks rather than <br>: an unset line must not leave a stray break. -->
					{#if contact.addressLine1}
						<span class="block">{contact.addressLine1}</span>
					{/if}

					{#if contact.addressLine2}
						<span class="block">{contact.addressLine2}</span>
					{/if}

					{#if contact.openingHours}
						<span class="mt-2 block text-caption text-paper/60">{contact.openingHours}</span>
					{/if}

					{#if contact.email}
						<a
							href="mailto:{contact.email}"
							class="mt-2 block text-label text-yellow underline underline-offset-3"
						>
							{contact.email}
						</a>
					{/if}
				</address>
			{/if}

			{#if contact.mapUrl}
				<div class="mt-8 overflow-hidden border-2 border-blue">
					<!-- The URL is admin-editable, so the frame is boxed in: scripts and
					     its own origin are what a map needs to draw itself, and popups
					     are what "view larger map" needs. Everything else - top-level
					     navigation above all - stays denied. `allow-same-origin` is safe
					     alongside `allow-scripts` only because the map is cross-origin;
					     it would defeat the sandbox on a same-origin frame. -->
					<iframe
						src={contact.mapUrl}
						title={m.contact_map_title()}
						loading="lazy"
						referrerpolicy="no-referrer-when-downgrade"
						sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
						class="block aspect-video w-full border-0"
					></iframe>
				</div>
			{/if}

			{#if contact.mapLink}
				<a
					href={contact.mapLink}
					target="_blank"
					rel="noreferrer"
					class="mt-3 inline-block text-caption text-yellow underline underline-offset-3"
				>
					{m.contact_open_in_maps()}
				</a>
			{/if}
		</div>

		<!-- Form --------------------------------------------------------------->
		<div>
			<h2 class="mb-5 text-panel font-bold text-yellow">{formHeading}</h2>

			{#if sent}
				<div
					bind:this={successPanel}
					role="status"
					aria-live="polite"
					tabindex="-1"
					class="border-l-4 border-yellow bg-blue p-8"
				>
					<h3 class="mb-3 text-subheading font-bold text-yellow">
						{m.contact_form_success_title()}
					</h3>
					<p class="mb-6 text-body leading-body text-paper/85">
						{m.contact_form_success_body({ phone: contact.primaryPhone?.number ?? '' })}
					</p>
					<button type="button" onclick={sendAnother} class="btn btn-ghost">
						{m.contact_form_send_another()}
					</button>
				</div>
			{:else}
				<form {...submitContactForm} class="flex flex-col gap-4">
					<input {...fields.locale.as('hidden', locale)} />

					<div>
						<label class="eyebrow mb-chip block text-note text-paper/60" for="contact-name">
							{m.contact_form_name_label()}
						</label>
						<input
							id="contact-name"
							{...fields.name.as('text')}
							class="field"
							placeholder={m.contact_form_name_placeholder()}
							aria-describedby={issues.name ? 'contact-name-error' : undefined}
							autocomplete="name"
							required
						/>
						{@render fieldError('contact-name-error', issues.name)}
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="eyebrow mb-chip block text-note text-paper/60" for="contact-email">
								{m.contact_form_email_label()}
							</label>
							<input
								id="contact-email"
								{...fields.email.as('email')}
								class="field"
								placeholder={m.contact_form_email_placeholder()}
								aria-describedby={issues.email ? 'contact-email-error' : undefined}
								autocomplete="email"
								required
							/>
							{@render fieldError('contact-email-error', issues.email)}
						</div>

						<div>
							<label class="eyebrow mb-chip block text-note text-paper/60" for="contact-phone">
								{m.contact_form_phone_label()}
							</label>
							<input
								id="contact-phone"
								{...fields.phone.as('tel')}
								class="field"
								placeholder={m.contact_form_phone_placeholder()}
								aria-describedby={issues.phone ? 'contact-phone-error' : undefined}
								autocomplete="tel"
							/>
							{@render fieldError('contact-phone-error', issues.phone)}
						</div>
					</div>

					{#if contact.courses.length > 0}
						<div>
							<label class="eyebrow mb-chip block text-note text-paper/60" for="contact-course">
								{m.contact_form_course_label()}
							</label>
							<select
								id="contact-course"
								{...fields.course.as('select')}
								class="field"
								aria-describedby={issues.course ? 'contact-course-error' : undefined}
							>
								{#each contact.courses as course (course.value)}
									<option value={course.value}>{course.label}</option>
								{/each}
							</select>
							{@render fieldError('contact-course-error', issues.course)}
						</div>
					{/if}

					<div>
						<label class="eyebrow mb-chip block text-note text-paper/60" for="contact-message">
							{m.contact_form_message_label()}
						</label>
						<textarea
							id="contact-message"
							{...fields.message.as('text')}
							rows="6"
							class="field"
							placeholder={m.contact_form_message_placeholder()}
							aria-describedby={issues.message ? 'contact-message-error' : undefined}
							required></textarea>
						{@render fieldError('contact-message-error', issues.message)}
					</div>

					<div>
						<TurnstileWidget bind:this={captcha} field={fields.turnstileToken} />
						{@render fieldError('contact-captcha-error', issues.captcha)}
					</div>

					<button
						type="submit"
						class="btn btn-red self-start px-8 py-4 tracking-wider"
						disabled={pending}
					>
						{#if pending}
							{m.contact_form_sending()}
						{:else}
							{m.contact_form_submit()}
							<ArrowRight class="size-4" aria-hidden="true" />
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>

{#snippet fieldError(id: string, list: RemoteFormIssue[] | undefined)}
	{#if list}
		<p {id} class="mt-2 text-note font-bold text-red">
			{list.map((issue) => issue.message).join(' ')}
		</p>
	{/if}
{/snippet}
