<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { telHref } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { SiteContact } from '#lib/remote/site.remote';
	import logo from '#lib/assets/efekt-logo.jpg';

	let { contact }: { contact: SiteContact } = $props();

	let open = $state(false);
	let burger: HTMLButtonElement | undefined = $state();

	const links = $derived([
		{ href: '/', label: m.nav_home(), match: (id: string | null) => id === '/(site)' },
		{
			href: '/instruktorzy',
			label: m.nav_instructors(),
			match: (id: string | null) => !!id?.startsWith('/(site)/instruktorzy')
		},
		{
			href: '/blog',
			label: m.nav_blog(),
			match: (id: string | null) => !!id?.startsWith('/(site)/blog')
		},
		{
			href: '/kontakt',
			label: m.nav_contact(),
			match: (id: string | null) => !!id?.startsWith('/(site)/kontakt')
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

<nav class="sticky top-0 z-100 border-b-[3px] border-red bg-navy">
	<div class="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6">
		<a href={localizeHref('/')} class="shrink-0" aria-label={m.site_name()}>
			<!-- Source is 2048x607; 162x48 preserves that ratio so the row does not
			     reflow while the image loads. -->
			<img src={logo} alt={m.logo_alt()} class="block h-12 w-auto" width="162" height="48" />
		</a>

		<div class="hidden items-center gap-1 md:flex">
			{#each links as link (link.href)}
				{@const active = link.match(currentId)}
				<a
					href={localizeHref(link.href)}
					aria-current={active ? 'page' : undefined}
					class="rounded-[2px] border-2 px-5 py-2 text-[0.95rem] tracking-[0.04em] transition-colors
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
					class="ml-4 rounded-[2px] bg-yellow px-5 py-2 text-[0.9rem] font-bold text-navy transition-colors hover:bg-yellow/85"
				>
					📞 {contact.primaryPhone.number}
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
			class="rounded-[2px] border-2 border-paper px-[0.6rem] py-[0.3rem] text-xl leading-none text-paper md:hidden"
		>
			{open ? '✕' : '☰'}
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
				class="border-b border-white/15 py-[0.6rem] text-left text-[1.05rem] text-paper
					{active ? 'bg-red px-3 font-bold' : ''}"
			>
				{link.label}
			</a>
		{/each}
	</div>
</nav>
