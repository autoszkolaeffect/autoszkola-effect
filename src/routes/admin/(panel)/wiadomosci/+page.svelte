<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { countUnreadMessages, listMessages } from '#lib/remote/admin-messages.remote';
	import type { MessageFilter } from '#lib/remote/message-filters';
	import AdminEmpty from '#lib/components/admin/AdminEmpty.svelte';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import { formatDateTime } from '#lib/format';
	import * as m from '#lib/paraglide/messages';

	// Polish query parameter and values, for the same reason the admin routes are Polish.
	const FILTER_PARAM = 'filtr';

	const tabs: { value: MessageFilter; param: string; label: string }[] = [
		{ value: 'unread', param: 'nieprzeczytane', label: m.admin_messages_unread() },
		{ value: 'all', param: 'wszystkie', label: m.admin_messages_all() },
		{ value: 'archived', param: 'archiwum', label: m.admin_messages_archived() }
	];

	function filterFromParam(param: string | null): MessageFilter {
		return tabs.find((tab) => tab.param === param)?.value ?? 'unread';
	}

	// The URL is the only source of truth for the active tab, so opening a message
	// and coming back lands on the tab it was opened from, and back and forward
	// move the tabs too.
	const filter = $derived(filterFromParam(page.url.searchParams.get(FILTER_PARAM)));

	// Real links rather than buttons driving shallow history: `filter` is derived
	// from the URL, and a shallow pushState entry does not restore its search
	// params on a back navigation, which would leave the tabs and the list
	// disagreeing.
	function tabHref(tab: (typeof tabs)[number]): string {
		const path =
			tab.value === 'unread'
				? '/admin/wiadomosci'
				: `/admin/wiadomosci?${FILTER_PARAM}=${encodeURIComponent(tab.param)}`;

		return localizeHref(path);
	}

	// Both derived: marking a message read refreshes the list and the count
	// together, and a snapshot of either would contradict the rows beside it.
	const messages = $derived(await listMessages({ filter }));
	const unread = $derived(await countUnreadMessages());

	const unreadMarker = m.admin_messages_unread_marker();
</script>

<AdminPage title={m.admin_messages_title()} intro={m.admin_messages_intro()}>
	<div class="mb-6 flex flex-wrap gap-2">
		{#each tabs as tab (tab.value)}
			{@const on = tab.value === filter}
			<a
				href={tabHref(tab)}
				data-sveltekit-reset="false"
				aria-current={on ? 'page' : undefined}
				class="flex items-center gap-2 border-2 px-4 py-[0.4rem] text-[0.85rem] transition-colors duration-150
					{on
					? 'border-yellow bg-yellow font-bold text-navy'
					: 'border-white/25 bg-transparent font-normal text-paper/70 hover:text-paper'}"
			>
				{tab.label}

				{#if tab.value === 'unread' && unread > 0}
					<span
						class="px-[0.35rem] text-[0.72rem] font-bold {on
							? 'bg-navy text-yellow'
							: 'bg-red text-paper'}"
					>
						<span aria-hidden="true">{unread}</span>
						<span class="sr-only">{m.admin_messages_unread_count({ count: unread })}</span>
					</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if messages.length === 0}
		<AdminEmpty text={m.admin_messages_empty()} />
	{:else}
		<ul class="flex flex-col gap-px">
			{#each messages as message (message.id)}
				{@const isUnread = message.readAt === null}
				<li>
					<!-- An opened message is dimmed and loses its yellow edge, so the
					     ones still waiting for an answer are the ones that read as
					     present on the page. -->
					<a
						href={localizeHref(`/admin/wiadomosci/${message.id}`)}
						class="block border-l-[3px] px-5 py-4 transition-colors
							{isUnread ? 'border-yellow bg-blue' : 'border-transparent bg-blue/50 opacity-70 hover:opacity-100'}"
					>
						<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<span class="flex items-baseline gap-2 font-display font-bold text-paper">
								{#if isUnread}
									<span class="size-2 shrink-0 self-center bg-yellow" aria-hidden="true"></span>
									<span class="sr-only">{unreadMarker}</span>
								{/if}
								{message.name}
							</span>

							<span class="text-[0.78rem] text-paper/50">
								{formatDateTime(message.createdAt)}
							</span>
						</div>

						<div class="mt-1 flex flex-wrap items-center gap-x-3 text-[0.8rem] text-paper/60">
							<span class="break-all">{message.email}</span>

							{#if message.course}
								<span class="eyebrow border border-white/20 px-2 text-[0.68rem] text-paper/70">
									{message.course}
								</span>
							{/if}
						</div>

						<p class="mt-2 line-clamp-2 text-[0.85rem] leading-[1.6] text-paper/70">
							{message.preview}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</AdminPage>
