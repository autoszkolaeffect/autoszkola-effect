/**
 * The Open Graph card as a satori element tree.
 *
 * Satori renders a React element tree, but it only ever reads `type` and
 * `props`, so the tree is built here from plain objects - no JSX, no React.
 * It lays out with flexbox alone, which is why every div holding more than one
 * child says `display: 'flex'`, and why the text that has to be cut short says
 * `display: 'block'`: satori honours `lineClamp` on block text only.
 *
 * Nothing in here touches the filesystem or the app, so the tree can be
 * rendered from a plain Node script with fonts read off the disk.
 */

import { ACCENT_HEX, NAVY_HEX, PAPER_HEX } from '#lib/accents';

export type OgCardInput = {
	/** Small uppercase line above the title: the site name, or a post's category. */
	eyebrow: string;
	title: string;
	subtitle?: string;
	/** The site's host, bottom-left, so a shared card says where it leads. */
	host: string;
	/** Bottom-right note - a post's date and reading time. */
	caption?: string;
};

export type OgElement = {
	type: 'div' | 'img';
	props: {
		style?: OgStyle;
		src?: string;
		children?: OgChild | OgChild[];
	};
};

type OgStyle = Record<string, string | number>;
type OgChild = OgElement | string;

/** The standard Open Graph size; every consumer crops or scales from it. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Satori cannot read a CSS theme, so the colours come from src/lib/accents.ts,
// the TypeScript mirror of the tokens in src/routes/layout.css. Only the font
// family names are restated here: they are what render.ts registers the font
// files under, and must stay in step with it.
const navy = NAVY_HEX;
const red = ACCENT_HEX.red;
const yellow = ACCENT_HEX.yellow;
const orange = ACCENT_HEX.orange;
const paper = PAPER_HEX;
const paperMuted = withAlpha(PAPER_HEX, 0.75);
const paperFaint = withAlpha(PAPER_HEX, 0.6);
const rule = withAlpha(PAPER_HEX, 0.15);

const DISPLAY = 'Brygada 1918';
const BODY = 'Average Sans';

/** `#rrggbb` at an opacity - satori takes `rgba()`, not the `/ 75%` CSS syntax. */
function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const STRIPE_HEIGHT = 14;
const PAD_X = 72;
// Tighter above and below than at the sides: the stripe adds to the top, and
// the fullest card - a three-line title over a two-line sub line - needs the
// height more than the margins do.
const PAD_TOP = 44;
const PAD_BOTTOM = 52;

// The logo JPEG is 2048x607; 300 wide keeps its ratio at 89 high.
const LOGO_WIDTH = 300;
const LOGO_HEIGHT = 89;

/**
 * The whole card. `logoSrc` is a `data:` URL - satori resolves `<img>` sources
 * itself and has no way to reach a file on the function's disk.
 */
export function ogCard(input: OgCardInput, logoSrc: string): OgElement {
	return div(
		{
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			backgroundColor: navy,
			color: paper,
			fontFamily: BODY
		},
		[flagStripe(), page(input, logoSrc)]
	);
}

// The red / yellow / orange band from under the site's nav. Three flex
// children rather than a hard-stop gradient: three boxes have no stops to
// misplace.
function flagStripe(): OgElement {
	return div(
		{ display: 'flex', height: STRIPE_HEIGHT, flexShrink: 0 },
		[red, yellow, orange].map((colour) => div({ flexGrow: 1, backgroundColor: colour }))
	);
}

function page(input: OgCardInput, logoSrc: string): OgElement {
	return div(
		{
			display: 'flex',
			flexDirection: 'column',
			flexGrow: 1,
			justifyContent: 'space-between',
			paddingTop: PAD_TOP,
			paddingRight: PAD_X,
			paddingBottom: PAD_BOTTOM,
			paddingLeft: PAD_X
		},
		[logo(logoSrc), heading(input), footer(input)]
	);
}

function logo(src: string): OgElement {
	return { type: 'img', props: { src, style: { width: LOGO_WIDTH, height: LOGO_HEIGHT } } };
}

// Eyebrow, title and sub line behind a red left edge - the site's way of
// marking emphasis, in place of a shadow or a rounded box.
function heading(input: OgCardInput): OgElement {
	const lines: OgChild[] = [eyebrow(input.eyebrow), title(input.title)];

	if (input.subtitle) lines.push(subtitle(input.subtitle));

	return div(
		{
			display: 'flex',
			flexDirection: 'column',
			gap: 16,
			borderLeft: `8px solid ${red}`,
			paddingLeft: 32
		},
		lines
	);
}

function eyebrow(text: string): OgElement {
	return div(
		{
			display: 'block',
			lineClamp: 1,
			fontFamily: BODY,
			fontSize: 26,
			lineHeight: 1.25,
			letterSpacing: 3,
			textTransform: 'uppercase',
			color: yellow
		},
		text
	);
}

// Two lines at 72px or three at 56px: both fill about the same height, and
// both leave room between the logo and the footer with a two-line sub line
// under them. A third line at 72px would push the footer off the card, so the
// clamp cuts it - and the switch to the smaller size comes early enough that
// a title never hits that clamp: the display face runs about 26 characters a
// line at 72px, and 40 leaves word wrap its slack.
function title(text: string): OgElement {
	const short = text.length <= 40;

	return div(
		{
			display: 'block',
			lineClamp: short ? 2 : 3,
			fontFamily: DISPLAY,
			fontWeight: 700,
			fontSize: short ? 72 : 56,
			lineHeight: 1.1,
			color: paper
		},
		text
	);
}

function subtitle(text: string): OgElement {
	return div(
		{
			display: 'block',
			lineClamp: 2,
			fontFamily: BODY,
			fontSize: 30,
			lineHeight: 1.35,
			color: paperMuted
		},
		text
	);
}

function footer(input: OgCardInput): OgElement {
	const cells: OgChild[] = [footerText(input.host)];

	if (input.caption) cells.push(footerText(input.caption));

	return div(
		{
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			gap: 32,
			borderTop: `1px solid ${rule}`,
			paddingTop: 18
		},
		cells
	);
}

function footerText(text: string): OgElement {
	return div(
		{
			display: 'block',
			whiteSpace: 'nowrap',
			fontFamily: BODY,
			fontSize: 22,
			lineHeight: 1.3,
			color: paperFaint
		},
		text
	);
}

function div(style: OgStyle, children?: OgChild | OgChild[]): OgElement {
	return { type: 'div', props: { style, children } };
}
