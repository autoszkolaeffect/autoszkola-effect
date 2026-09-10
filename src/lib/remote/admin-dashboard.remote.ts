import { query } from '$app/server';
import { and, count, eq, isNull, sql, type SQLWrapper } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { blogPost, contactMessage, instructor, opinion, smtpSettings } from '#lib/server/db/schema';
import { requireAdmin } from '#lib/server/guard';

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;

/**
 * Counts the rows matching `condition` in the same pass as the total, so each
 * table is read once. `coalesce` because `sum()` over an empty table is NULL.
 */
const countWhere = (condition: SQLWrapper) =>
	sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`;

/**
 * The numbers on the dashboard, plus the unread count the sidebar badges the
 * messages link with. Screens that change any of these should refresh this
 * query so the badge does not go stale.
 */
export const getAdminOverview = query(async () => {
	requireAdmin();

	const [instructors] = await db
		.select({ total: count(), published: countWhere(eq(instructor.published, true)) })
		.from(instructor);

	const [posts] = await db
		.select({ total: count(), published: countWhere(eq(blogPost.status, 'published')) })
		.from(blogPost);

	const [opinions] = await db
		.select({ total: count(), published: countWhere(eq(opinion.published, true)) })
		.from(opinion);

	// Archived messages are off the desk even when they were never opened, so
	// they do not keep the badge lit.
	const [messages] = await db
		.select({ unread: count() })
		.from(contactMessage)
		.where(and(isNull(contactMessage.readAt), isNull(contactMessage.archivedAt)));

	const [smtp] = await db
		.select({
			enabled: smtpSettings.enabled,
			host: smtpSettings.host,
			fromAddress: smtpSettings.fromAddress,
			toAddress: smtpSettings.toAddress
		})
		.from(smtpSettings)
		.limit(1);

	const postsTotal = Number(posts?.total ?? 0);
	const postsPublished = Number(posts?.published ?? 0);

	return {
		instructors: {
			total: Number(instructors?.total ?? 0),
			published: Number(instructors?.published ?? 0)
		},
		posts: {
			total: postsTotal,
			published: postsPublished,
			drafts: postsTotal - postsPublished
		},
		opinions: {
			total: Number(opinions?.total ?? 0),
			published: Number(opinions?.published ?? 0)
		},
		unreadMessages: Number(messages?.unread ?? 0),
		smtp: {
			// "Configured" means a notification could actually be delivered - a host
			// alone is not enough without somewhere to send from and to.
			configured: Boolean(smtp?.host && smtp.fromAddress && smtp.toAddress),
			enabled: Boolean(smtp?.enabled)
		}
	};
});
