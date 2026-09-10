<script lang="ts">
	import { localizeHref } from '#lib/paraglide/runtime';
	import { telHref } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { SiteContact } from '#lib/remote/site.remote';
	import logo from '#lib/assets/efekt-logo.jpg';

	let { contact }: { contact: SiteContact } = $props();

	const links = [
		{ href: '/', label: m.nav_home() },
		{ href: '/instruktorzy', label: m.nav_instructors() },
		{ href: '/blog', label: m.nav_blog() },
		{ href: '/kontakt', label: m.nav_contact() }
	];

	// Rendered on the server, so this is the deploy year rather than the
	// visitor's clock - which is what a copyright line wants anyway.
	const year = new Date().getFullYear();
</script>

<footer class="border-t-[3px] border-blue bg-navy-deep px-6 pt-12 pb-8">
	<div
		class="mx-auto mb-10 grid max-w-[1100px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-10"
	>
		<div>
			<img src={logo} alt={m.logo_alt()} class="mb-4 block h-11 w-auto" width="148" height="44" />
			<p class="text-[0.88rem] leading-[1.7] text-paper/55">{m.footer_blurb()}</p>
		</div>

		<div>
			<h2 class="mb-4 font-display text-[0.9rem] font-bold tracking-widest text-yellow uppercase">
				{m.footer_nav_heading()}
			</h2>
			<ul>
				{#each links as link (link.href)}
					<li>
						<a
							href={localizeHref(link.href)}
							class="block py-1 text-[0.9rem] text-paper/60 transition-colors hover:text-yellow"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<div>
			<h2 class="mb-4 font-display text-[0.9rem] font-bold tracking-[0.1em] text-yellow uppercase">
				{m.footer_contact_heading()}
			</h2>
			<div class="text-[0.88rem] leading-[2] text-paper/60">
				{#if contact.footerAddress}
					<p>{contact.footerAddress}</p>
				{/if}
				{#each contact.phones as phone (phone.id)}
					<a href={telHref(phone.number)} class="block transition-colors hover:text-yellow"
						>{phone.number}</a
					>
				{/each}
				{#if contact.email}
					<a href="mailto:{contact.email}" class="block transition-colors hover:text-yellow"
						>{contact.email}</a
					>
				{/if}
			</div>
		</div>
	</div>

	<div
		class="mx-auto max-w-[1100px] border-t border-white/8 pt-6 text-center text-[0.8rem] text-paper/35"
	>
		{m.footer_copyright({ year })}
	</div>
</footer>
