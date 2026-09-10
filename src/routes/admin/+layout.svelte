<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<!-- The panel is reachable without a session only as a login form, but there
	     is nothing here worth indexing either way. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-navy text-paper">
	{@render children()}
</div>
