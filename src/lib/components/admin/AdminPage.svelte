<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '#lib/paraglide/messages';

	let {
		title,
		intro,
		actions,
		children
	}: {
		title: string;
		intro?: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} · {m.admin_title()}</title>
</svelte:head>

<div class="mx-auto max-w-[1100px] px-6 py-10">
	<header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
		<div class="min-w-0">
			<div class="section-rule bg-yellow"></div>
			<h1 class="text-[clamp(1.5rem,3vw,2rem)] font-bold text-paper">{title}</h1>
			{#if intro}
				<p class="mt-3 max-w-[620px] text-[0.92rem] leading-[1.7] text-paper/70">{intro}</p>
			{/if}
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-3">{@render actions()}</div>
		{/if}
	</header>

	{@render children()}
</div>
