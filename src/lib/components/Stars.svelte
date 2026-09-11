<script lang="ts">
	import { Star, StarHalf } from '@lucide/svelte';
	import { formatRating } from '#lib/format';
	import * as m from '#lib/paraglide/messages';

	let { rating, sizeClass = 'size-5' }: { rating: number; sizeClass?: string } = $props();

	const SLOTS = [1, 2, 3, 4, 5];

	// The row is always five stars wide, so a value from outside 0-5 is clamped
	// rather than allowed to add or drop a slot.
	const value = $derived(Math.min(Math.max(rating, 0), 5));
</script>

<span
	role="img"
	aria-label={m.opinions_rating({ rating: formatRating(value) })}
	class="inline-flex items-center gap-1 text-yellow"
>
	{#each SLOTS as slot (slot)}
		{#if value >= slot}
			<Star class={sizeClass} fill="currentColor" aria-hidden="true" />
		{:else if value >= slot - 0.5}
			<!-- The filled half sits on top of a whole outline, so the empty side of
			     the star still shows its edge instead of ending mid-air. -->
			<span class="relative {sizeClass}">
				<Star class={sizeClass} aria-hidden="true" />
				<StarHalf class="absolute inset-0 {sizeClass}" fill="currentColor" aria-hidden="true" />
			</span>
		{:else}
			<Star class={sizeClass} aria-hidden="true" />
		{/if}
	{/each}
</span>
