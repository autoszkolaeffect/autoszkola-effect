<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<section class="bg-blue p-6">
	{#if title}
		<h2 class="mb-5 text-[1.05rem] font-bold text-yellow">{title}</h2>
	{/if}

	{@render children()}
</section>
