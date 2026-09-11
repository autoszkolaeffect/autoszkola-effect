/**
 * The four accent colours from the palette, the Tailwind classes that go with
 * each, and their hex values. Kept in one place because three different rules
 * pick an accent - a blog category stores one of the four by name, an instructor
 * may be given a colour of its own, and an instructor without one cycles through
 * the palette by position - and all of them have to agree on what "yellow"
 * looks like.
 */

export const ACCENTS = ['red', 'yellow', 'blue', 'orange'] as const;

export type Accent = (typeof ACCENTS)[number];

/**
 * The same colours as hex. These mirror the `--color-*` theme tokens in
 * `src/routes/layout.css` and have to move with them. They exist because an
 * instructor's accent may be an arbitrary stored hex rather than one of the
 * four, so the fallback has to be expressible in the same form as the stored
 * value - a class name cannot stand in for a colour only known at runtime.
 */
export const ACCENT_HEX: Record<Accent, string> = {
	red: '#d62828',
	yellow: '#f5eb18',
	blue: '#0a4295',
	orange: '#f77f00'
};

/** `--color-navy` and `--color-paper`: the two colours text on an accent takes. */
export const NAVY_HEX = '#001633';
export const PAPER_HEX = '#fafafa';

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

// Yellow and orange are the two accents light enough to need dark text on top.
// These pairings are the tabulated form of what `accentForeground` computes for
// an arbitrary hex, so the two cannot drift apart - orange must not read white
// on a category chip and navy on an instructor badge.
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
		solid: 'bg-orange text-navy',
		bg: 'bg-orange',
		border: 'border-orange',
		text: 'text-orange'
	}
};

export function accentClasses(accent: Accent | null | undefined): AccentClasses {
	return CLASSES[accent ?? 'red'] ?? CLASSES.red;
}

/**
 * The accent an instructor card takes from its position in the grid: the design
 * cycles yellow, red, blue, orange down the list, so reordering re-colours the
 * grid automatically. This is the fallback rather than the whole rule - an
 * instructor given a colour of its own keeps it wherever it sits. Go through
 * `instructorAccentHex` unless you specifically want the positional colour.
 */
export function instructorAccent(index: number): Accent {
	const cycle: Accent[] = ['yellow', 'red', 'blue', 'orange'];
	return cycle[index % cycle.length];
}

const ACCENT_HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/** Whether a value is a six-digit hex colour we can hand to CSS as-is. */
export function isAccentHex(value: string | null | undefined): value is string {
	return typeof value === 'string' && ACCENT_HEX_PATTERN.test(value);
}

/**
 * The colour an instructor card is painted with: the stored one when it is a
 * usable hex, otherwise the positional cycle. Both the published grid and the
 * admin list call this, so "stored wins, position is the fallback" is decided
 * once - and an instructor whose accent was never set, or was set to something
 * the database will not vouch for, is painted exactly as it was before colours
 * were storable. Only the badge's text moved with the change: on the orange
 * step it is now navy, because `accentForeground` computes it rather than
 * reading it off the design.
 */
export function instructorAccentHex(stored: string | null | undefined, index: number): string {
	return isAccentHex(stored) ? stored : ACCENT_HEX[instructorAccent(index)];
}

/**
 * Navy or paper, whichever reads better on top of `hex`, by WCAG contrast
 * ratio. Yellow and orange are light enough to want navy; red and blue want
 * paper - but a colour picked in the admin panel can land anywhere between the
 * four, so the choice is computed rather than tabulated. A hex the database
 * gave us but CSS would reject falls back to paper instead of throwing, since
 * the card still has to render.
 */
export function accentForeground(hex: string): string {
	if (!isAccentHex(hex)) return PAPER_HEX;
	return bestForeground(hex).foreground;
}

/**
 * Whether the better of navy and paper clears 4.5:1 on `hex` - the AA minimum
 * for normal-size text, which is what a badge is at `text-badge`. Picking the
 * better of only two foregrounds has a floor: the two curves cross at a
 * background luminance of ~0.192, where both sit at 4.16:1, so a mid-tone
 * accent fails whichever way `accentForeground` goes (`#767676` reaches 4.35:1
 * on paper, 3.98:1 on navy). The admin editor warns on that rather than
 * refusing the colour. A malformed hex passes: it never reaches CSS - the card
 * falls back to the palette - so warning about it would point the admin at a
 * problem they cannot see.
 */
export function accentMeetsAA(hex: string): boolean {
	if (!isAccentHex(hex)) return true;
	return bestForeground(hex).ratio >= 4.5;
}

/**
 * The better of the two foregrounds on `hex`, with the ratio it reaches.
 * `accentForeground` and `accentMeetsAA` ask the same question of a colour and
 * keep different halves of the answer, so it is worked out once here. Callers
 * must have checked `isAccentHex` first.
 */
function bestForeground(hex: string): { foreground: string; ratio: number } {
	const background = relativeLuminance(hex);
	const onNavy = contrastRatio(background, relativeLuminance(NAVY_HEX));
	const onPaper = contrastRatio(background, relativeLuminance(PAPER_HEX));
	return onNavy >= onPaper
		? { foreground: NAVY_HEX, ratio: onNavy }
		: { foreground: PAPER_HEX, ratio: onPaper };
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function relativeLuminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((offset) => {
		const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: number, b: number): number {
	const lighter = Math.max(a, b);
	const darker = Math.min(a, b);
	return (lighter + 0.05) / (darker + 0.05);
}
