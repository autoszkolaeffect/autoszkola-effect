/**
 * The three views of the inbox.
 *
 * This lives outside `admin-messages.remote.ts` because a `.remote.ts` module may
 * export nothing but remote functions - SvelteKit rejects any other runtime export
 * at build time, since every export becomes an addressable endpoint.
 */
export const MESSAGE_FILTERS = ['unread', 'all', 'archived'] as const;

export type MessageFilter = (typeof MESSAGE_FILTERS)[number];
