<script lang="ts">
	import type { Snippet } from 'svelte';
	import { baseLocale, contentLocales, localeName, type Locale } from '#lib/locales';

	let { children }: { children: Snippet<[string]> } = $props();

	let active = $state<Locale>(baseLocale);
</script>

<!-- With a single locale there is nothing to switch between, so the editor is
     rendered bare rather than under a one-item tab strip. -->
{#if contentLocales.length > 1}
	<div class="mb-5 flex flex-wrap gap-1 border-b border-white/12" role="tablist">
		{#each contentLocales as locale (locale)}
			{@const selected = locale === active}
			<button
				type="button"
				role="tab"
				aria-selected={selected}
				onclick={() => (active = locale)}
				class="eyebrow -mb-px border-b-[3px] px-4 py-2 text-[0.75rem] transition-colors
					{selected
					? 'border-yellow font-bold text-yellow'
					: 'border-transparent text-paper/60 hover:text-paper'}"
			>
				{localeName(locale)}
			</button>
		{/each}
	</div>
{/if}

{@render children(active)}
