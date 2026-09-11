<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { telHref } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { SiteContact } from '#lib/remote/site.remote';
	import logo from '#lib/assets/efekt-logo.jpg';
	import { Menu, Phone, X } from '@lucide/svelte';

	let { contact }: { contact: SiteContact } = $props();

	let open = $state(false);
	let burger: HTMLButtonElement | undefined = $state();

	const links = $derived([
		{ href: '/', label: m.nav_home(), match: (id: string | null) => id === '/(site)' },
		{
			href: '/instructors',
			label: m.nav_instructors(),
			match: (id: string | null) => !!id?.startsWith('/(site)/instructors')
		},
		{
			href: '/blog',
			label: m.nav_blog(),
			match: (id: string | null) => !!id?.startsWith('/(site)/blog')
		},
		{
			href: '/contact',
			label: m.nav_contact(),
			match: (id: string | null) => !!id?.startsWith('/(site)/contact')
		}
	]);

	// `page.route.id` rather than the pathname: it is already locale-independent,
	// so the active pill stays correct whatever prefix the URL carries.
	const currentId = $derived(page.route.id);

	function closeOnEscape(event: KeyboardEvent) {
		if (!open || event.key !== 'Escape') return;

		open = false;
		// Focus is most likely inside the drawer that just disappeared, so it has to
		// be put somewhere deliberate rather than dropped onto <body>.
		burger?.focus();
	}
</script>

<svelte:window onkeydown={closeOnEscape} />

<nav class="sticky top-0 z-100 border-b-3 border-red bg-navy">
	<div class="mx-auto flex h-18 max-w-300 items-center justify-between px-6">
		<a href={localizeHref('/')} class="shrink-0" aria-label={m.site_name()}>
			<!-- Source is 2048x607; 162x48 preserves that ratio so the row does not
			     reflow while the image loads. -->
			<img src={logo} alt={m.logo_alt()} class="block h-12 w-auto" width="162" height="48" />
		</a>

		<div class="hidden items-center gap-1 lg:flex">
			{#each links as link (link.href)}
				{@const active = link.match(currentId)}
				<a
					href={localizeHref(link.href)}
					aria-current={active ? 'page' : undefined}
					class="rounded-pill border-2 px-5 py-2 text-body tracking-button transition-colors
						{active
						? 'border-red bg-red font-bold text-paper'
						: 'border-transparent text-paper hover:border-paper/25'}"
				>
					{link.label}
				</a>
			{/each}

			{#if contact.primaryPhone?.number}
				<a
					href={telHref(contact.primaryPhone.number)}
					class="ml-4 inline-flex items-center gap-2 rounded-pill bg-yellow px-5 py-2 text-label font-bold text-navy transition-colors hover:bg-yellow/85"
				>
					<Phone class="size-4" aria-hidden="true" />
					{contact.primaryPhone.number}
				</a>
			{/if}
		</div>

		<button
			bind:this={burger}
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="site-menu"
			aria-label={open ? m.nav_close_menu() : m.nav_open_menu()}
			class="inline-flex items-center justify-center rounded-pill border-2 border-paper px-tag py-snug text-paper lg:hidden"
		>
			{#if open}<X class="size-5" aria-hidden="true" />{:else}<Menu
					class="size-5"
					aria-hidden="true"
				/>{/if}
		</button>
	</div>

	<!-- Hidden with a class rather than an `{#if}`: the burger's `aria-controls`
	     has to resolve to a real element even while the drawer is shut. -->
	<div id="site-menu" class="flex-col gap-2 bg-blue px-6 py-4 md:hidden {open ? 'flex' : 'hidden'}">
		{#each links as link (link.href)}
			{@const active = link.match(currentId)}
			<a
				href={localizeHref(link.href)}
				onclick={() => (open = false)}
				aria-current={active ? 'page' : undefined}
				class="border-b border-white/15 py-tag text-left text-body-lg text-paper
					{active ? 'bg-red px-3 font-bold' : ''}"
			>
				{link.label}
			</a>
		{/each}
	</div>
</nav>
