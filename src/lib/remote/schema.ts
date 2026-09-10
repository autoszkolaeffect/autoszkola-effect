import * as v from 'valibot';
import { isLocale, type Locale } from '#lib/paraglide/runtime';

/**
 * Validates a locale argument coming off the wire. Remote functions are publicly
 * addressable endpoints, so their arguments are untrusted even when every call
 * site in our own code passes `getLocale()`.
 */
export const localeArg = v.pipe(
	v.string(),
	v.check((value): value is Locale => isLocale(value), 'Nieznany język.')
) as unknown as v.GenericSchema<string, Locale>;

/** A non-empty, trimmed string. */
export const trimmed = (message: string, max = 500) =>
	v.pipe(v.string(), v.trim(), v.minLength(1, message), v.maxLength(max));

/** A trimmed string that is allowed to be empty. */
export const optionalText = (max = 500) => v.pipe(v.string(), v.trim(), v.maxLength(max));

export const idArg = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

/**
 * Per-locale content, indexed by the locale's position in `contentLocales`.
 *
 * Indexed rather than keyed by locale tag because a form field name is parsed as
 * a JavaScript path: `text.en-GB.pageTitle` is not one, so a tag with a hyphen
 * would be rejected before this schema ever saw it.
 *
 * The locale tabs only mount the fields of the locale being edited, so the array
 * arrives with holes - which is why every entry is optional, and why a position
 * that never arrives is left untouched when the rows are written. The types are
 * restated because `RemoteFormInput` has no way to describe a sparse array, and
 * an item type of `T | undefined` would reject the whole form schema; the input
 * is spelled the way TypeScript models any array, one element per position.
 */
export const perLocale = <TSchema extends v.GenericSchema>(schema: TSchema) =>
	v.array(v.optional(schema)) as unknown as v.GenericSchema<
		v.InferInput<TSchema>[],
		(v.InferOutput<TSchema> | undefined)[]
	>;
