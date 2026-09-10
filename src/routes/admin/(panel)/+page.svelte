<script lang="ts">
	import { localizeHref } from '#lib/paraglide/runtime';
	import { getAdminOverview } from '#lib/remote/admin-dashboard.remote';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import * as m from '#lib/paraglide/messages';

	const overview = await getAdminOverview();

	const intro = m.admin_dashboard_intro();

	const visible = (count: number) => m.admin_dashboard_visible_count({ count });

	const blogBreakdown = (published: number, drafts: number) =>
		m.admin_dashboard_blog_breakdown({ published, drafts });

	const unreadCaption = m.admin_dashboard_unread_caption();

	const allRead = m.admin_dashboard_all_read();

	const smtp = $derived.by(() => {
		if (!overview.smtp.configured) {
			return {
				value: m.admin_dashboard_smtp_missing(),
				caption: m.admin_dashboard_smtp_missing_hint()
			};
		}

		if (overview.smtp.enabled) {
			return {
				value: m.admin_dashboard_smtp_on(),
				caption: m.admin_dashboard_smtp_on_hint()
			};
		}

		return {
			value: m.admin_dashboard_smtp_off(),
			caption: m.admin_dashboard_smtp_off_hint()
		};
	});

	const cards = $derived([
		{
			href: '/admin/instruktorzy',
			title: m.admin_nav_instructors(),
			value: String(overview.instructors.total),
			caption: visible(overview.instructors.published),
			accent: 'border-yellow'
		},
		{
			href: '/admin/blog',
			title: m.admin_nav_blog(),
			value: String(overview.posts.total),
			caption: blogBreakdown(overview.posts.published, overview.posts.drafts),
			accent: 'border-yellow'
		},
		{
			href: '/admin/opinie',
			title: m.admin_nav_opinions(),
			value: String(overview.opinions.total),
			caption: visible(overview.opinions.published),
			accent: 'border-yellow'
		},
		{
			href: '/admin/wiadomosci',
			title: m.admin_nav_messages(),
			value: String(overview.unreadMessages),
			caption: overview.unreadMessages > 0 ? unreadCaption : allRead,
			// The one card that changes colour: unread messages are the only thing
			// on this page that asks the admin to do something.
			accent: overview.unreadMessages > 0 ? 'border-red' : 'border-yellow'
		},
		{
			href: '/admin/poczta',
			title: m.admin_nav_smtp(),
			value: smtp.value,
			caption: smtp.caption,
			accent: overview.smtp.configured ? 'border-yellow' : 'border-red'
		}
	]);
</script>

<AdminPage title={m.admin_title()} {intro}>
	<div class="grid [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-4">
		{#each cards as card (card.href)}
			<a
				href={localizeHref(card.href)}
				class="block border-t-[3px] {card.accent} bg-blue p-5 transition-colors hover:bg-blue/75"
			>
				<h2 class="eyebrow text-[0.72rem] font-normal text-paper/60">{card.title}</h2>
				<p class="mt-3 font-display text-[1.9rem] leading-tight font-bold break-words text-yellow">
					{card.value}
				</p>
				<p class="mt-2 text-[0.82rem] leading-[1.55] text-paper/65">{card.caption}</p>
			</a>
		{/each}
	</div>
</AdminPage>
