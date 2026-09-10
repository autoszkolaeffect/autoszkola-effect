<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Spread onto the control, so the hint and the issues are read out with it. */
	type FieldAria = {
		'aria-describedby': string | undefined;
		'aria-invalid': boolean | undefined;
	};

	let {
		label,
		hint,
		issues,
		children
	}: {
		label: string;
		hint?: string;
		issues?: { message: string }[];
		/**
		 * Receives the id to put on the control, so the label points at it, plus the
		 * aria attributes tying it to the hint and the issues rendered below it:
		 * `<input {id} {...aria} />`.
		 */
		children: Snippet<[string, FieldAria]>;
	} = $props();

	const id = $props.id();
	const hintId = `${id}-hint`;
	const issuesId = `${id}-issues`;

	const hasIssues = $derived(issues !== undefined && issues.length > 0);

	const describedBy = $derived(
		[...(hint ? [hintId] : []), ...(hasIssues ? [issuesId] : [])].join(' ')
	);

	const aria: FieldAria = $derived({
		// Empty rather than absent would point the control at nothing.
		'aria-describedby': describedBy || undefined,
		'aria-invalid': hasIssues || undefined
	});
</script>

<div class="flex flex-col gap-2">
	<label class="eyebrow text-eyebrow text-paper/60" for={id}>{label}</label>

	{@render children(id, aria)}

	{#if hint}
		<p id={hintId} class="text-hint leading-hint text-paper/55">{hint}</p>
	{/if}

	{#if hasIssues && issues}
		<ul id={issuesId}>
			<!-- Red text on the blue card is unreadable, so the error reads as paper
			     on a red-tinted strip with a red edge - the same "emphasis by
			     coloured edge" the rest of the design uses. -->
			{#each issues as issue, index (index)}
				<li class="border-l-3 border-red bg-red/20 px-3 py-2 text-note leading-normal text-paper">
					{issue.message}
				</li>
			{/each}
		</ul>
	{/if}
</div>
