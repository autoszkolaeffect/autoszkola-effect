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
	<div class="mx-auto max-w-[900px]">
		<div class="section-rule bg-yellow"></div>
		<h1 class="mb-4 text-[clamp(2rem,5vw,3.2rem)] font-bold text-paper">
			{m.instructors_title()}
		</h1>
		<p class="max-w-[580px] text-[1.05rem] leading-[1.7] text-paper/80">
			{m.instructors_intro()}
		</p>
	</div>
</section>

<!-- Card grid ---------------------------------------------------------------->
<section class="mx-auto max-w-[1100px] px-6 py-16">
	{#if instructors.length === 0}
		<p class="text-[1.05rem] leading-[1.7] text-paper/70">{m.instructors_empty()}</p>
	{:else}
		<div class="grid [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-8">
			{#each instructors as instructor, index (instructor.id)}
				<!-- The accent is positional, not stored, so reordering in the admin
				     panel re-colours the grid on its own. -->
				{@const accent = accentClasses(instructorAccent(index))}

				<article
					class="overflow-hidden bg-blue transition-transform duration-200 hover:-translate-y-1"
				>
					<div class="relative h-[280px] overflow-hidden">
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
							<div
								class="absolute inset-x-0 bottom-0 h-[40%] bg-[linear-gradient(transparent,rgba(0,22,51,0.9))]"
							></div>
						{:else}
							<div
								class="flex h-full w-full items-center justify-center bg-navy text-[0.85rem] tracking-[0.08em] text-paper/45 uppercase"
							>
								{m.admin_instructors_photo_missing()}
							</div>
						{/if}

						{#if instructor.badge}
							<p
								class="absolute bottom-3 left-4 px-[0.6rem] py-1 text-[0.75rem] font-bold tracking-[0.1em] uppercase {accent.solid}"
							>
								{instructor.badge}
							</p>
						{/if}
					</div>

					<div class="p-6">
						<h2 class="mb-1 text-[1.35rem] font-bold text-paper">{instructor.name}</h2>
						{#if instructor.experience}
							<p class="mb-4 text-[0.82rem] tracking-[0.08em] text-yellow uppercase">
								{instructor.experience}
							</p>
						{/if}
						<p class="text-[0.92rem] leading-[1.68] text-paper/80">{instructor.bio}</p>
					</div>

					<div class="h-1 {accent.bg}"></div>
				</article>
			{/each}
		</div>
	{/if}
</section>
