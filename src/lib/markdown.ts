import MarkdownIt from 'markdown-it';

// Raw HTML is disabled, which is what makes the output safe without a sanitiser:
// markdown-it escapes any `<script>` or `<img onerror=...>` an author types
// instead of passing it through. Blog posts are plain prose - headings,
// emphasis, lists and links - and carry no media, so nothing is lost.
//
// `validateLink` is markdown-it's own allow-list; it already rejects
// `javascript:`, `vbscript:` and `file:` URLs, and the override below narrows it
// further to the schemes a blog post has any business linking to.
const md = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: false,
	typographer: false
});

const SAFE_LINK = /^(https?:|mailto:|tel:|#|\/)/i;

md.validateLink = (url) => SAFE_LINK.test(url.trim());

// Send outbound links to a new tab without handing the target window a
// reference back to ours.
const defaultLinkOpen =
	md.renderer.rules.link_open ??
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	const href = tokens[idx].attrGet('href') ?? '';

	if (/^https?:/i.test(href)) {
		tokens[idx].attrSet('target', '_blank');
		tokens[idx].attrSet('rel', 'noopener noreferrer');
	}

	return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Renders a markdown document to HTML. Safe to inject with `{@html}`. */
export function renderMarkdown(markdown: string): string {
	return md.render(markdown ?? '');
}

/** Renders a single line of markdown without wrapping it in a paragraph. */
export function renderMarkdownInline(markdown: string): string {
	return md.renderInline(markdown ?? '');
}

/**
 * Strips markdown down to its words. Used for reading-time estimates and for
 * meta descriptions.
 */
export function markdownToPlainText(markdown: string): string {
	return (markdown ?? '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/^\s{0,3}[-*+]\s+/gm, '')
		.replace(/[*_~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Reading time in whole minutes, at 200 words per minute and never less than
 * one. The admin panel offers this as a starting point; the stored value is
 * whatever the editor decides.
 */
export function estimateReadingMinutes(markdown: string): number {
	const words = markdownToPlainText(markdown).split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}
