/**
 * Instructor photos are stored inline in the database as `data:image/...;base64,...`
 * URLs rather than as files, which only works because they are small: a D1 row
 * cannot exceed 1 MB. The admin form downscales in the browser before submitting
 * and the server rejects anything that still arrives over the ceiling.
 *
 * These constants live here rather than in `admin-instructors.remote.ts` because
 * a `.remote.ts` module may only export remote functions - anything else throws
 * when the module is initialised - and both sides of the upload need them.
 */

/** The largest photo the server will store, measured on the stored data URL. */
export const MAX_PHOTO_BYTES = 700_000;

/** Longest edge after downscaling, in pixels. */
const MAX_EDGE = 800;

/** Quality passed to `canvas.toDataURL('image/jpeg', ...)`. */
const QUALITY = 0.72;

const PHOTO_DATA_URL = /^data:image\/(jpeg|png|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Bytes the value occupies once stored. A well-formed data URL is ASCII, so this
 * matches its length - but the field is a public endpoint's input, so it is
 * measured rather than assumed.
 */
export function photoByteLength(value: string): number {
	return new TextEncoder().encode(value).length;
}

export function isPhotoDataUrl(value: string): boolean {
	return PHOTO_DATA_URL.test(value);
}

/**
 * Reads a picked file, caps its longest edge at {@link MAX_EDGE} and re-encodes
 * it as a JPEG data URL. Always JPEG: a PNG portrait straight off a phone stays
 * far too large for a database row even after the resize.
 *
 * Browser only - it needs a canvas.
 */
export async function downscalePhoto(file: File): Promise<string> {
	const image = await loadImage(file);
	const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas 2D context unavailable.');

	context.drawImage(image, 0, 0, canvas.width, canvas.height);

	return canvas.toDataURL('image/jpeg', QUALITY);
}

/**
 * An `<img>` rather than `createImageBitmap`, because the element applies the
 * EXIF orientation on its own - portraits shot on a phone would otherwise be
 * drawn onto the canvas lying on their side.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();

		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};

		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('The browser could not decode this file as an image.'));
		};

		image.src = url;
	});
}
