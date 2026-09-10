<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime';
	import { listInstructors } from '#lib/remote/site.remote';
	import { accentClasses, instructorAccent } from '#lib/accents';
	import * as m from '#lib/paraglide/messages';

	const instructors = await listInstructors(getLocale());
</script>

<svelte:head>
	<title>{m.instructors_title()} - {m.site_name()}</title>
	<meta name="description" content={m.instructors_intro()} />
</svelte:head>

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
				<!-- The accent is positional, not stored, so reordering in the admin
				     panel re-colours the grid on its own. -->
				{@const accent = accentClasses(instructorAccent(index))}

				<article
					class="relative overflow-hidden bg-blue transition-transform duration-200 hover:-translate-y-1"
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
								class="absolute bottom-3 left-4 px-tag py-1 text-badge font-bold tracking-widest uppercase {accent.solid}"
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

					<div class="absolute bottom-0 h-1 w-full {accent.bg}"></div>
				</article>
			{/each}
		</div>
	{/if}
</section>
