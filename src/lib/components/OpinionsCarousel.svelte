<script lang="ts">
	import * as m from '#lib/paraglide/messages';
	import type { PublicOpinion } from '#lib/remote/site.remote';

	let { opinions }: { opinions: PublicOpinion[] } = $props();

	// Three cards are on screen at a time and the window wraps, so every opinion
	// gets to be the highlighted leftmost card exactly once per cycle.
	const VISIBLE = 3;
	const ROTATE_MS = 6000;

	let start = $state(0);
	let paused = $state(false);
	let interacting = $state(false);
	// Starts false so the server render and the first client render agree; the
	// effect below corrects it as soon as the component is live in the browser.
	let reducedMotion = $state(false);

	const visible = $derived(
		Array.from({ length: Math.min(VISIBLE, opinions.length) }, (_, offset) => {
			const index = (start + offset) % opinions.length;
			return { ...opinions[index], index, offset };
		})
	);

	// Only a window that leaves something off screen has anywhere to advance to,
	// and a visitor who asked for less motion gets none of it unasked.
	const rotates = $derived(opinions.length > VISIBLE && !reducedMotion);

	const go = (index: number) => {
		start = ((index % opinions.length) + opinions.length) % opinions.length;
	};

	$effect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reducedMotion = query.matches);

		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!rotates || paused || interacting) return;

		const timer = setInterval(() => go(start + 1), ROTATE_MS);
		return () => clearInterval(timer);
	});
</script>

<div
	role="group"
	aria-roledescription="carousel"
	aria-label={m.opinions_heading()}
	onmouseenter={() => (interacting = true)}
	onmouseleave={() => (interacting = false)}
	onfocusin={() => (interacting = true)}
	onfocusout={() => (interacting = false)}
>
	<div class="grid grid-quotes gap-5">
		{#each visible as item (item.id)}
			{@const active = item.offset === 0}
			<figure
				class="animate-fade-slide border-t-3 p-7 transition-opacity duration-300
					{active ? 'border-t-yellow bg-navy opacity-100' : 'border-t-yellow/35 bg-navy/55 opacity-65'}"
			>
				<span
					class="text-lead tracking-stars text-yellow"
					aria-label={m.opinions_rating({ rating: item.rating })}
				>
					{'★'.repeat(item.rating)}
				</span>
				<blockquote class="mt-3 mb-4 text-body leading-body text-paper/85 italic">
					{item.quote}
				</blockquote>
				<!-- The dash belongs to the design, not to the data: the admin panel's own
				     hint asks for the name without one. See IMPLEMENTATION.md. -->
				<figcaption class="font-display text-label font-bold text-yellow">
					- {item.author}
				</figcaption>
			</figure>
		{/each}
	</div>

	<!-- Nothing to page through when every opinion is already on screen, so the
	     controls stay out rather than rotating cards that never leave the view. -->
	{#if opinions.length > VISIBLE}
		<div class="mt-8 flex items-center gap-4">
			<button
				type="button"
				onclick={() => go(start - 1)}
				aria-label={m.opinions_previous()}
				class="flex h-10 w-10 items-center justify-center border-2 border-yellow/60 text-lead text-yellow transition-colors hover:border-yellow"
			>
				‹
			</button>

			<div class="flex gap-2">
				{#each opinions as opinion, index (opinion.id)}
					<button
						type="button"
						onclick={() => go(index)}
						aria-label={m.opinions_go_to({ index: index + 1 })}
						aria-current={index === start ? 'true' : undefined}
						class="h-2 transition-all duration-300 {index === start
							? 'w-6 bg-yellow'
							: 'w-2 bg-yellow/30 hover:bg-yellow/60'}"
					></button>
				{/each}
			</div>

			<button
				type="button"
				onclick={() => go(start + 1)}
				aria-label={m.opinions_next()}
				class="flex h-10 w-10 items-center justify-center border-2 border-yellow/60 text-lead text-yellow transition-colors hover:border-yellow"
			>
				›
			</button>

			{#if rotates}
				<button
					type="button"
					onclick={() => (paused = !paused)}
					aria-label={paused ? m.opinions_resume() : m.opinions_pause()}
					class="flex h-10 w-10 items-center justify-center border-2 border-yellow/60 text-label text-yellow transition-colors hover:border-yellow"
				>
					<!-- U+FE0E keeps the play glyph a text character instead of an emoji. -->
					{paused ? '▶︎' : '❚❚'}
				</button>
			{/if}
		</div>
	{/if}
</div>
