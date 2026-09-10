import { command, query } from '$app/server';
import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import * as v from 'valibot';

import { db } from '#lib/server/db';
import { contactMessage } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';
import { getAdminOverview } from './admin-dashboard.remote';
import { idArg } from './schema';
import { MESSAGE_FILTERS, type MessageFilter } from './message-filters';

// The notifications area: everything the contact form has dropped in the
// operator's lap. Nothing here writes content - a message is a record of what a
// visitor sent, so the only mutations are the three states it can be in (read,
// archived, gone).

/** How much of the body the inbox shows before the row gets an ellipsis. */
const PREVIEW_CHARS = 180;

function scopeOf(filter: MessageFilter) {
	switch (filter) {
		case 'unread':
			return and(isNull(contactMessage.archivedAt), isNull(contactMessage.readAt));
		case 'archived':
			return isNotNull(contactMessage.archivedAt);
		// "all" is everything still on the desk: the archive is a separate drawer
		// rather than a subset of the inbox, so archived messages stay out of it.
		default:
			return isNull(contactMessage.archivedAt);
	}
}

/**
 * The inbox rows and the counts beside them all move together, so every mutation
 * below refreshes them here on the server. That way the fresh data rides back
 * with the mutation's own response instead of costing a round-trip each, and a
 * change made on the detail page is already applied when the operator returns to
 * the list.
 *
 * `getAdminOverview` is refreshed alongside our own count because it is what the
 * sidebar badge and the dashboard card actually read.
 */
async function refreshInbox(filters: readonly MessageFilter[]) {
	await Promise.all([
		...filters.map((filter) => listMessages({ filter }).refresh()),
		countUnreadMessages().refresh(),
		getAdminOverview().refresh()
	]);
}

export type AdminMessageSummary = Awaited<ReturnType<typeof listMessages>>[number];

export const listMessages = query(
	v.object({ filter: v.picklist(MESSAGE_FILTERS) }),
	async ({ filter }) => {
		requireAdmin();

		const rows = await db
			.select({
				id: contactMessage.id,
				name: contactMessage.name,
				email: contactMessage.email,
				course: contactMessage.course,
				createdAt: contactMessage.createdAt,
				readAt: contactMessage.readAt,
				// A body runs to 5000 characters and the list shows a line of it, so
				// the rest never leaves the database.
				preview: sql<string>`substr(${contactMessage.message}, 1, ${PREVIEW_CHARS})`,
				truncated: sql<number>`case when length(${contactMessage.message}) > ${PREVIEW_CHARS} then 1 else 0 end`
			})
			.from(contactMessage)
			.where(scopeOf(filter))
			.orderBy(desc(contactMessage.createdAt));

		return rows.map(({ truncated, preview, ...row }) => ({
			...row,
			preview: truncated ? `${preview.trimEnd()}…` : preview
		}));
	}
);

export type AdminMessage = NonNullable<Awaited<ReturnType<typeof getMessage>>>;

export const getMessage = query(idArg, async (id) => {
	requireAdmin();

	const [row] = await db.select().from(contactMessage).where(eq(contactMessage.id, id)).limit(1);

	return row ?? null;
});

/** Archived messages are off the desk even when unread, so they never count. */
export const countUnreadMessages = query(async () => {
	requireAdmin();

	const [row] = await db
		.select({ unread: count() })
		.from(contactMessage)
		.where(and(isNull(contactMessage.readAt), isNull(contactMessage.archivedAt)));

	return Number(row?.unread ?? 0);
});

export const markMessageRead = command(
	v.object({ id: idArg, read: v.boolean() }),
	async ({ id, read }) => {
		requireAdmin();

		await db
			.update(contactMessage)
			.set({ readAt: read ? new Date() : null })
			.where(eq(contactMessage.id, id));

		await getMessage(id).refresh();
		// The archive is indifferent to whether a message was opened.
		await refreshInbox(['unread', 'all']);
	}
);

export const archiveMessage = command(
	v.object({ id: idArg, archived: v.boolean() }),
	async ({ id, archived }) => {
		requireAdmin();

		await db
			.update(contactMessage)
			.set({ archivedAt: archived ? new Date() : null })
			.where(eq(contactMessage.id, id));

		await getMessage(id).refresh();
		await refreshInbox(MESSAGE_FILTERS);
	}
);

export const deleteMessage = command(idArg, async (id) => {
	requireAdmin();

	await db.delete(contactMessage).where(eq(contactMessage.id, id));

	// Deliberately not refreshing `getMessage` - the row is gone and the caller
	// is on its way back to the list.
	await refreshInbox(MESSAGE_FILTERS);
});
