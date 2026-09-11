<script lang="ts">
	import { onMount } from 'svelte';
	import { Carta, MarkdownEditor as CartaEditor } from 'carta-md';
	import 'carta-md/default.css';
	import * as m from '#lib/paraglide/messages';

	let {
		value = $bindable(''),
		name,
		id,
		aria,
		placeholder = ''
	}: {
		value?: string;
		/** The form field name, from `fields.….as('text').name`. */
		name: string;
		id?: string;
		/** AdminField's second snippet argument, forwarded to carta's textarea. */
		aria?: { 'aria-describedby': string | undefined; 'aria-invalid': boolean | undefined };
		placeholder?: string;
	} = $props();

	// `sanitizer: false` is the safe choice here only because carta's default
	// pipeline is remark -> rehype without `allowDangerousHtml`, so raw HTML in
	// the markdown never reaches the preview in the first place - there is
	// nothing left for a sanitiser to strip. The public site does not use this
	// pipeline at all; it renders through src/lib/markdown.ts, which disables
	// raw HTML for the same reason.
	//
	// Built after mount rather than at module scope so nothing carta touches
	// runs during SSR.
	let carta = $state.raw<Carta>();
	let mirror = $state<HTMLTextAreaElement>();

	onMount(() => {
		carta = new Carta({ sanitizer: false });
	});

	$effect(() => {
		if (!mirror) return;

		// Carta owns its own textarea and never names it, so the markdown only
		// reaches the form through this mirror - and a value assigned from code
		// fires no `input` event, which is exactly what the remote form listens
		// for to keep `fields.…value()` and validation in step with the editor.
		mirror.value = value;
		mirror.dispatchEvent(new Event('input', { bubbles: true }));
	});
</script>

{#if carta}
	<div class="markdown-editor">
		<CartaEditor
			{carta}
			bind:value
			mode="tabs"
			{placeholder}
			textarea={{ id, ...aria }}
			userLabels={{ writeTab: m.admin_blog_write(), previewTab: m.admin_blog_preview() }}
		/>
	</div>

	<textarea {name} bind:this={mirror} {value} hidden readonly tabindex="-1" aria-hidden="true"
	></textarea>
{:else}
	<!-- Until carta mounts - and for a server-rendered page that never gets
	     there - the field stays a plain textarea, so the form is still editable
	     and still submits. Bound, so anything typed in the moment before carta
	     takes over carries into it. -->
	<textarea {name} {id} {placeholder} bind:value rows="18" class="field font-mono text-label"
	></textarea>
{/if}

<style>
	/* Carta ships light-mode defaults on global class names. They are overridden
	   here rather than in layout.css because they belong to this component, and
	   scoping them under .markdown-editor keeps them out of everything else. */
	.markdown-editor :global(.carta-editor) {
		--border-color: rgba(255, 255, 255, 0.2);
		--selection-color: rgba(245, 235, 24, 0.25);
		--focus-outline: var(--color-yellow);
		--hover-color: rgba(255, 255, 255, 0.1);
		--caret-color: var(--color-yellow);
		--text-color: var(--color-paper);

		background: var(--color-navy);
		border: 1px solid var(--border-color);
		border-radius: 0;
	}

	.markdown-editor :global(.carta-toolbar) {
		height: 2.5rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.markdown-editor :global(.carta-toolbar-left button) {
		font-family: var(--font-body);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(250, 250, 250, 0.6);
	}

	.markdown-editor :global(.carta-toolbar-left button.carta-active) {
		color: var(--color-yellow);
		border-bottom-color: var(--color-yellow);
	}

	.markdown-editor :global(.carta-icon),
	.markdown-editor :global(.carta-icon-full) {
		color: rgba(250, 250, 250, 0.75);
	}

	.markdown-editor :global(.carta-icons-menu) {
		background: var(--color-navy-deep);
		border-radius: 0;
	}

	.markdown-editor :global(.carta-input),
	.markdown-editor :global(.carta-renderer) {
		/* Carta's default is a fixed 600px, which dwarfs the rest of the panel. */
		height: 26rem;
	}

	.markdown-editor :global(.carta-font-code) {
		font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace;
		font-size: 0.85rem;
		line-height: 1.7;
	}

	/* The text in the "write" tab is not the textarea - that one is transparent -
	   but shiki's highlighted copy layered underneath it. Carta asks shiki for a
	   light/dark pair, and shiki paints the light colours inline while carrying
	   the dark ones only in `--shiki-dark`, expecting a `.dark` ancestor to swap
	   them in. The panel has no light mode, so the swap is unconditional here.
	   `!important` is the documented way past the inline styles. */
	.markdown-editor :global(.carta-highlight .shiki),
	.markdown-editor :global(.carta-highlight .shiki span) {
		color: var(--shiki-dark) !important;
	}

	/* The preview is the same rendered-markdown look the article page uses. */
	.markdown-editor :global(.carta-renderer) {
		color: rgba(250, 250, 250, 0.82);
		font-family: var(--font-body);
	}

	.markdown-editor :global(.carta-renderer h1),
	.markdown-editor :global(.carta-renderer h2),
	.markdown-editor :global(.carta-renderer h3),
	.markdown-editor :global(.carta-renderer h4) {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-yellow);
		margin-bottom: 0.5rem;
	}

	.markdown-editor :global(.carta-renderer a) {
		color: var(--color-yellow);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.markdown-editor :global(.carta-renderer blockquote) {
		border-left: 3px solid var(--color-yellow);
		padding-left: 1rem;
		font-style: italic;
	}

	.markdown-editor :global(.carta-renderer code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1em 0.35em;
	}

	.markdown-editor :global(.carta-renderer ul) {
		list-style: disc;
		padding-left: 1.35rem;
	}

	.markdown-editor :global(.carta-renderer ol) {
		list-style: decimal;
		padding-left: 1.35rem;
	}
</style>
