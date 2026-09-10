<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { localizeHref } from '#lib/paraglide/runtime';
	import {
		archiveMessage,
		deleteMessage,
		getMessage,
		markMessageRead
	} from '#lib/remote/admin-messages.remote';
	import AdminCard from '#lib/components/admin/AdminCard.svelte';
	import AdminPage from '#lib/components/admin/AdminPage.svelte';
	import { formatDateTime, telHref } from '#lib/format';
	import * as m from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	const { params }: PageProps = $props();

	// Derived rather than awaited once, so moving between messages re-reads the
	// query. `error` returns `never`, which both narrows `message` and turns a
	// deleted id into a real 404.
	const message = $derived((await getMessage(params.id)) ?? error(404, m.error_404_title()));

	let failed = $state(false);

	const busy = $derived(
		markMessageRead.pending + archiveMessage.pending + deleteMessage.pending > 0
	);

	async function run(action: () => Promise<unknown>) {
		failed = false;

		try {
			await action();
		} catch {
			failed = true;
		}
	}

	// Opening a message marks it read. Remembering which one was marked keeps the
	// "mark unread" button below from being undone by this effect the moment it
	// clears `readAt`.
	let autoMarkedId: string | null = null;

	$effect(() => {
		const { id, readAt } = message;
		if (readAt || autoMarkedId === id) return;

		autoMarkedId = id;
		void run(() => markMessageRead({ id, read: true }));
	});

	async function remove() {
		if (!confirm(m.admin_delete_confirm())) return;

		await run(async () => {
			await deleteMessage(message.id);
			await goto(localizeHref('/admin/messages'));
		});
	}

	const notification = $derived.by(() => {
		switch (message.notificationStatus) {
			case 'sent':
				return {
					label: m.admin_messages_notification_sent(),
					tone: 'border-yellow bg-yellow/10 text-yellow'
				};
			case 'failed':
				// Red text on the blue card is unreadable, so a failure reads as paper
				// on a red-tinted strip - the same "emphasis by coloured edge" the rest
				// of the design uses.
				return {
					label: m.admin_messages_notification_failed(),
					tone: 'border-red bg-red/20 text-paper'
				};
			case 'skipped':
				return {
					label: m.admin_messages_notification_skipped(),
					tone: 'border-white/25 bg-white/5 text-paper/70'
				};
			default:
				return {
					label: m.admin_messages_notification_pending(),
					tone: 'border-white/25 bg-white/5 text-paper/70'
				};
		}
	});

	const replySubject = m.admin_messages_reply_subject();

	const replyHref = $derived(`mailto:${message.email}?subject=${encodeURIComponent(replySubject)}`);

	const phoneLabel = m.admin_messages_phone();
	const bodyLabel = m.admin_messages_body();
	const technicalLabel = m.admin_messages_technical();
	const localeLabel = m.admin_messages_locale();
	const ipLabel = m.admin_messages_ip();
	const userAgentLabel = m.admin_messages_user_agent();
	const notificationSentAtLabel = m.admin_messages_notification_sent_at();
	const unknown = m.admin_messages_unknown();
</script>

<AdminPage title={message.name}>
	{#snippet actions()}
		<a href={localizeHref('/admin/messages')} class="text-caption text-yellow">
			{m.admin_back_to_list()}
		</a>

		<button
			type="button"
			disabled={busy}
			onclick={() => run(() => markMessageRead({ id: message.id, read: message.readAt === null }))}
			class="btn btn-ghost px-4 py-2 text-caption"
		>
			{message.readAt ? m.admin_messages_mark_unread() : m.admin_messages_mark_read()}
		</button>

		<button
			type="button"
			disabled={busy}
			onclick={() =>
				run(() => archiveMessage({ id: message.id, archived: message.archivedAt === null }))}
			class="btn btn-ghost px-4 py-2 text-caption"
		>
			{message.archivedAt ? m.admin_messages_unarchive() : m.admin_messages_archive()}
		</button>

		<button
			type="button"
			disabled={busy}
			onclick={remove}
			class="btn btn-red px-4 py-2 text-caption"
		>
			{deleteMessage.pending > 0 ? m.admin_deleting() : m.admin_delete()}
		</button>
	{/snippet}

	<div class="flex flex-col gap-6">
		{#if failed}
			<p class="border-l-3 border-red bg-red/20 px-4 py-3 text-caption text-paper" role="alert">
				{m.admin_error_generic()}
			</p>
		{/if}

		<AdminCard>
			<dl class="grid grid-fields gap-x-6 gap-y-5">
				<div class="min-w-0">
					<dt class="eyebrow text-eyebrow text-paper/60">{m.admin_messages_from()}</dt>
					<dd class="mt-1 text-body text-paper">
						{message.name}
						<a
							href="mailto:{message.email}"
							class="mt-1 block text-label break-all text-yellow underline underline-offset-3"
						>
							{message.email}
						</a>
					</dd>
				</div>

				<div class="min-w-0">
					<dt class="eyebrow text-eyebrow text-paper/60">{m.admin_messages_received()}</dt>
					<dd class="mt-1 text-body text-paper">{formatDateTime(message.createdAt)}</dd>
				</div>

				{#if message.phone}
					<div class="min-w-0">
						<dt class="eyebrow text-eyebrow text-paper/60">{phoneLabel}</dt>
						<dd class="mt-1 text-body">
							<a href={telHref(message.phone)} class="text-yellow underline underline-offset-3">
								{message.phone}
							</a>
						</dd>
					</div>
				{/if}

				{#if message.course}
					<div class="min-w-0">
						<dt class="eyebrow text-eyebrow text-paper/60">{m.admin_messages_course()}</dt>
						<dd class="mt-1 text-body break-words text-paper">{message.course}</dd>
					</div>
				{/if}
			</dl>
		</AdminCard>

		<AdminCard title={bodyLabel}>
			<!-- Written by an anonymous visitor, so it is rendered as text and never
			     as markup. `whitespace-pre-wrap` keeps the paragraphs they typed. -->
			<p class="text-body leading-quote break-words whitespace-pre-wrap text-paper/85">
				{message.message}
			</p>

			<a href={replyHref} class="btn btn-yellow mt-6 px-5 py-3 text-label">
				{m.admin_messages_reply()}
			</a>
		</AdminCard>

		<AdminCard title={m.admin_messages_notification()}>
			<p class="inline-block border-l-3 px-3 py-2 text-caption font-bold {notification.tone}">
				{notification.label}
			</p>

			{#if message.notificationSentAt}
				<p class="mt-3 text-meta text-paper/60">
					{notificationSentAtLabel}: {formatDateTime(message.notificationSentAt)}
				</p>
			{/if}

			{#if message.notificationError}
				<!-- The raw SMTP error, verbatim: it is the only thing that says why
				     the mail did not go out. -->
				<pre
					class="mt-4 overflow-x-auto border-l-3 border-red bg-navy p-4 font-mono text-hint leading-hint whitespace-pre-wrap text-paper/75">{message.notificationError}</pre>
			{/if}
		</AdminCard>

		<AdminCard title={technicalLabel}>
			<dl class="grid grid-fields gap-x-6 gap-y-5">
				<div class="min-w-0">
					<dt class="eyebrow text-eyebrow text-paper/60">{localeLabel}</dt>
					<dd class="mt-1 text-caption text-paper/75">{message.locale}</dd>
				</div>

				<div class="min-w-0">
					<dt class="eyebrow text-eyebrow text-paper/60">{ipLabel}</dt>
					<dd class="mt-1 font-mono text-note break-all text-paper/75">
						{message.ipAddress ?? unknown}
					</dd>
				</div>

				<div class="min-w-0">
					<dt class="eyebrow text-eyebrow text-paper/60">{userAgentLabel}</dt>
					<dd class="mt-1 font-mono text-note break-all text-paper/75">
						{message.userAgent ?? unknown}
					</dd>
				</div>
			</dl>
		</AdminCard>
	</div>
</AdminPage>
