import { Resvg } from '@resvg/resvg-js';
import satori, { type Font } from 'satori';
import { read } from '$app/server';

import logoUrl from '#lib/assets/efekt-logo.jpg';
import { OG_HEIGHT, OG_WIDTH, ogCard, type OgCardInput } from './card';
import averageSansUrl from './average-sans-400.ttf';
import brygadaUrl from './brygada-1918-700.ttf';

export type { OgCardInput };

type Assets = {
	fonts: Font[];
	/** The logo as a `data:` URL, which is the only kind of `<img>` satori can load here. */
	logoSrc: string;
};

/**
 * Renders one Open Graph card to a 1200x630 PNG.
 *
 * Satori lays the card out and emits an SVG in which every glyph is already a
 * path, so resvg only has to rasterise it - it needs no fonts of its own and is
 * told not to go looking for the system's.
 */
export async function renderOgImage(input: OgCardInput): Promise<Uint8Array<ArrayBuffer>> {
	const { fonts, logoSrc } = await loadAssets();

	const svg = await satori(ogCard(input, logoSrc), { width: OG_WIDTH, height: OG_HEIGHT, fonts });

	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: OG_WIDTH },
		font: { loadSystemFonts: false }
	})
		.render()
		.asPng();

	// A fresh copy rather than the addon's Buffer: `Response` wants a view over a
	// plain ArrayBuffer, and a Buffer's may be anything.
	return new Uint8Array(png);
}

let assets: Promise<Assets> | undefined;

/**
 * The fonts and the logo, read once per function instance. The promise itself
 * is cached, so concurrent first requests share one read, and a warm instance
 * never touches the disk again. A failed read is dropped from the cache so it
 * cannot turn one bad cold start into a permanently broken instance.
 */
function loadAssets(): Promise<Assets> {
	assets ??= readAssets().catch((error: unknown) => {
		assets = undefined;
		throw error;
	});

	return assets;
}

/**
 * The files are imported as Vite assets and opened with `read()` rather than
 * `fs`: that is what tells the adapter to ship them inside the serverless
 * function, and what resolves the hashed production URL back to the bytes.
 *
 * Two faces because the site sets its headings in the display serif and
 * everything else in the body sans - one weight of each is all the card uses.
 */
async function readAssets(): Promise<Assets> {
	const [brygada, averageSans, logo] = await Promise.all([
		read(brygadaUrl).arrayBuffer(),
		read(averageSansUrl).arrayBuffer(),
		read(logoUrl).arrayBuffer()
	]);

	return {
		fonts: [
			{ name: 'Brygada 1918', data: brygada, weight: 700, style: 'normal' },
			{ name: 'Average Sans', data: averageSans, weight: 400, style: 'normal' }
		],
		logoSrc: `data:image/jpeg;base64,${Buffer.from(logo).toString('base64')}`
	};
}
