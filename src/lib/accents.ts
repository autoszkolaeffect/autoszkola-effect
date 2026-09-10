/**
 * The four accent colours from the palette, and the Tailwind classes that go
 * with each. Kept in one place because two different rules pick an accent - the
 * instructor grid cycles through them by position, while a blog category stores
 * the one it was given - and both have to agree on what "yellow" looks like.
 */

export const ACCENTS = ['red', 'yellow', 'blue', 'orange'] as const;

export type Accent = (typeof ACCENTS)[number];

type AccentClasses = {
	/** Solid fill with legible text on top - badges, chips. */
	solid: string;
	/** `background-color` only, for rules and bars. */
	bg: string;
	/** `border-color` only. */
	border: string;
	/** `color` only. */
	text: string;
};

// Yellow is the one accent light enough to need dark text on top.
const CLASSES: Record<Accent, AccentClasses> = {
	red: {
		solid: 'bg-red text-paper',
		bg: 'bg-red',
		border: 'border-red',
		text: 'text-red'
	},
	yellow: {
		solid: 'bg-yellow text-navy',
		bg: 'bg-yellow',
		border: 'border-yellow',
		text: 'text-yellow'
	},
	blue: {
		solid: 'bg-blue text-paper',
		bg: 'bg-blue',
		border: 'border-blue',
		text: 'text-blue'
	},
	orange: {
		solid: 'bg-orange text-paper',
		bg: 'bg-orange',
		border: 'border-orange',
		text: 'text-orange'
	}
};

export function accentClasses(accent: Accent | null | undefined): AccentClasses {
	return CLASSES[accent ?? 'red'] ?? CLASSES.red;
}

/**
 * The accent an instructor card takes, from its position in the grid. The
 * design cycles yellow, red, blue, orange down the list rather than storing a
 * colour per instructor, so reordering re-colours the grid automatically.
 */
export function instructorAccent(index: number): Accent {
	const cycle: Accent[] = ['yellow', 'red', 'blue', 'orange'];
	return cycle[index % cycle.length];
}
