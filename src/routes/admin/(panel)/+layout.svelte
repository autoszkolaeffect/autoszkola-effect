<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { getAdminOverview } from '#lib/remote/admin-dashboard.remote';
	import * as m from '#lib/paraglide/messages';
	import logo from '#lib/assets/efekt-logo.jpg';
	import { ArrowLeft, Menu, X } from '@lucide/svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Derived rather than awaited once: the layout outlives every screen under it,
	// so a snapshot would freeze the unread badge for the whole admin session.
	const overview = $derived(await getAdminOverview());

	let open = $state(false);

	const links = $derived([
		{ href: '/admin', label: m.admin_nav_dashboard(), badge: 0 },
		{ href: '/admin/instructors', label: m.admin_nav_instructors(), badge: 0 },
		{ href: '/admin/blog', label: m.admin_nav_blog(), badge: 0 },
		{ href: '/admin/opinions', label: m.admin_nav_opinions(), badge: 0 },
		{ href: '/admin/contact', label: m.admin_nav_contact(), badge: 0 },
		{
			href: '/admin/messages',
			label: m.admin_nav_messages(),
			badge: overview.unreadMessages
		},
		{ href: '/admin/smtp', label: m.admin_nav_smtp(), badge: 0 }
	]);

	// Route ids carry the layout group - `/admin/(panel)/blog` - so dropping it
	// gives the same shape as the hrefs above, whatever prefix the URL has.
	const currentPath = $derived(page.route.id?.replace('/(panel)', '') ?? '');

	const isActive = (href: string) =>
		currentPath === href || (href !== '/admin' && currentPath.startsWith(`${href}/`));

	const signOutAction = `${localizeHref('/admin/login')}?/logout`;
</script>

<div class="md:flex md:items-start">
	<aside
		class="flex flex-col border-red bg-navy-deep max-md:border-b-3 md:sticky md:top-0 md:h-screen md:w-62 md:shrink-0 md:border-r-3"
	>
		<div class="flex items-center justify-between gap-4 px-5 py-4">
			<a href={localizeHref('/admin')} onclick={() => (open = false)} class="block">
				<img src={logo} alt={m.logo_alt()} class="block h-10 w-auto" width="135" height="40" />
				<span class="eyebrow mt-2 block text-micro text-paper/50">{m.admin_title()}</span>
			</a>

			<button
				type="button"
				onclick={() => (open = !open)}
				aria-expanded={open}
				aria-controls="admin-menu"
				aria-label={open ? m.nav_close_menu() : m.nav_open_menu()}
				class="inline-flex items-center justify-center rounded-pill border-2 border-paper px-tag py-snug text-paper md:hidden"
			>
				{#if open}<X class="size-5" aria-hidden="true" />{:else}<Menu
						class="size-5"
						aria-hidden="true"
					/>{/if}
			</button>
		</div>

		<div id="admin-menu" class="flex-1 flex-col justify-between md:flex {open ? 'flex' : 'hidden'}">
			<nav class="flex flex-col gap-px px-3 pb-4">
				{#each links as link (link.href)}
					{@const active = isActive(link.href)}
					<a
						href={localizeHref(link.href)}
						onclick={() => (open = false)}
						aria-current={active ? 'page' : undefined}
						class="flex items-center justify-between gap-3 border-l-3 px-4 py-tag text-body-sm transition-colors
							{active
							? 'border-yellow bg-blue font-bold text-yellow'
							: 'border-transparent text-paper/75 hover:border-white/25 hover:text-paper'}"
					>
						<span>{link.label}</span>
						{#if link.badge > 0}
							<span class="bg-red px-chip py-hairline text-eyebrow font-bold text-paper">
								<span aria-hidden="true">{link.badge}</span>
								<!-- The bare digit tells a screen reader nothing, so the link's
								     accessible name spells the count out instead. -->
								<span class="sr-only">
									{m.admin_messages_unread_count({ count: link.badge })}
								</span>
							</span>
						{/if}
					</a>
				{/each}
			</nav>

			<div class="border-t border-white/10 px-5 py-5">
				<p class="text-byline leading-normal wrap-break-word text-paper/55">
					{m.admin_signed_in_as({ email: data.user.email })}
				</p>

				<form method="POST" action={signOutAction} class="mt-3">
					<button type="submit" class="text-meta text-yellow underline underline-offset-4 cursor-pointer">
						{m.admin_sign_out()}
					</button>
				</form>

				<a
					href={localizeHref('/')}
					class="mt-3 flex items-center gap-2 text-meta text-paper/55 transition-colors hover:text-paper"
				>
					<ArrowLeft class="size-4" aria-hidden="true" />
					{m.admin_back_to_site()}
				</a>
			</div>
		</div>
	</aside>

	<main class="min-h-screen min-w-0 flex-1">
		{@render children()}
	</main>
</div>
