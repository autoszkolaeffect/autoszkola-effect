<script lang="ts">
	import { page } from '$app/state';
	import { getLocale } from '#lib/paraglide/runtime';
	import { listInstructors } from '#lib/remote/site.remote';
	import Seo from '#lib/components/Seo.svelte';
	import { accentForeground, instructorAccentHex } from '#lib/accents';
	import { metaDescription, ogImageHref, pageTitle } from '#lib/seo';
	import * as m from '#lib/paraglide/messages';

	const locale = getLocale();
	const instructors = await listInstructors(locale);
</script>

<Seo
	title={pageTitle(m.instructors_title())}
	description={metaDescription(m.instructors_intro())}
	path="/instructors"
	image={ogImageHref(page.url.origin, locale, 'instructors')}
/>

<!-- Page header band --------------------------------------------------------->
<section class="border-b-4 border-yellow bg-blue px-6 pt-16 pb-12">
	<div class="mx-auto max-w-225">
		<div class="section-rule bg-yellow"></div>
		<h1 class="mb-4 text-page font-bold text-paper">
			{m.instructors_title()}
		</h1>
		<p class="max-w-145 text-body-lg leading-body text-paper/80">
			{m.instructors_intro()}
		</p>
	</div>
</section>

<!-- Card grid ---------------------------------------------------------------->
<section class="mx-auto max-w-275 px-6 py-16">
	{#if instructors.length === 0}
		<p class="text-body-lg leading-body text-paper/70">{m.instructors_empty()}</p>
	{:else}
		<div class="grid grid-cards gap-8">
			{#each instructors as instructor, index (instructor.id)}
				<!-- An instructor can be given a colour in the admin panel; one that has
				     not been keeps following its position, so reordering still re-colours
				     the rest of the grid. -->
				{@const hex = instructorAccentHex(instructor.accent, index)}
				{@const on = accentForeground(hex)}

				<article
					class="relative overflow-hidden bg-blue transition-transform duration-200 hover:-translate-y-1"
					style:--accent={hex}
					style:--accent-on={on}
				>
					<div class="relative h-70 overflow-hidden">
						{#if instructor.photo}
							<img
								src={instructor.photo}
								alt={m.instructors_photo_alt({ name: instructor.name })}
								width="600"
								height="600"
								loading={index < 2 ? 'eager' : 'lazy'}
								decoding="async"
								class="block h-full w-full object-cover"
							/>
							<div class="absolute inset-x-0 bottom-0 h-2/5 bg-photo-scrim"></div>
						{:else}
							<div
								class="flex h-full w-full items-center justify-center bg-navy text-caption tracking-eyebrow text-paper/45 uppercase"
							>
								{m.admin_instructors_photo_missing()}
							</div>
						{/if}

						{#if instructor.badge}
							<p
								class="absolute bottom-3 left-4 bg-accent px-tag py-1 text-badge font-bold tracking-widest text-on-accent uppercase"
							>
								{instructor.badge}
							</p>
						{/if}
					</div>

					<div class="p-6">
						<h2 class="mb-1 text-person font-bold text-paper">{instructor.name}</h2>
						{#if instructor.experience}
							<p class="mb-4 text-meta tracking-eyebrow text-yellow uppercase">
								{instructor.experience}
							</p>
						{/if}
						<p class="text-body-sm leading-bio text-paper/80">{instructor.bio}</p>
					</div>

					<div class="absolute bottom-0 h-1 w-full bg-accent"></div>
				</article>
			{/each}
		</div>
	{/if}
</section>
