/**
 * Minimaler, bewusst sicherer Markdown-Renderer für die im Admin-Panel
 * gepflegten Texte (Impressum, Datenschutz, Widerruf, ...).
 *
 * Sicherheitsprinzip "escape first": Der Eingabetext wird ZUERST
 * vollständig HTML-escaped. Erst danach werden die erlaubten
 * Markdown-Konstrukte in Tags übersetzt. Dadurch kann aus dem Inhalt
 * heraus kein HTML und kein <script> entstehen – selbst dann nicht, wenn
 * ein Admin-Zugang kompromittiert wäre. Das ist der Grund, warum hier
 * keine vollwertige Markdown-Bibliothek verwendet wird: die geben
 * standardmäßig rohes HTML durch und bräuchten einen zusätzlichen
 * Sanitizer.
 *
 * Unterstützt: Überschriften (##, ###), Absätze, Listen (-, 1.), Fett,
 * Kursiv, Inline-Code und Links mit geprüftem Schema.
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Erlaubt nur unbedenkliche Link-Ziele (kein javascript:, data:, ...). */
function safeHref(href: string): string | null {
	const value = href.trim();
	if (value.startsWith('/') || value.startsWith('#')) return value;
	if (/^https?:\/\//i.test(value)) return value;
	if (/^mailto:[^\s]+$/i.test(value)) return value;
	return null;
}

/** Inline-Auszeichnungen auf bereits escapetem Text anwenden. */
function renderInline(escaped: string): string {
	let html = escaped;

	// Inline-Code zuerst, damit darin keine weiteren Regeln greifen.
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// [Text](Ziel)
	html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, rawHref: string) => {
		// Der Href stammt aus escapetem Text; &amp; wieder zurückwandeln,
		// damit Query-Parameter funktionieren.
		const href = safeHref(rawHref.replace(/&amp;/g, '&'));
		if (!href) return label;
		const external = /^https?:\/\//i.test(href);
		const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
		return `<a href="${escapeHtml(href)}"${attrs}>${label}</a>`;
	});

	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

	return html;
}

export function renderMarkdown(source: string): string {
	if (!source?.trim()) return '';

	const lines = escapeHtml(source).split(/\r?\n/);
	const blocks: string[] = [];

	let paragraph: string[] = [];
	let listItems: string[] = [];
	let listTag: 'ul' | 'ol' | null = null;

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
		paragraph = [];
	};

	const flushList = () => {
		if (!listTag || listItems.length === 0) {
			listTag = null;
			listItems = [];
			return;
		}
		const items = listItems.map((item) => `<li>${renderInline(item)}</li>`).join('');
		blocks.push(`<${listTag}>${items}</${listTag}>`);
		listTag = null;
		listItems = [];
	};

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed === '') {
			flushParagraph();
			flushList();
			continue;
		}

		const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
		if (heading) {
			flushParagraph();
			flushList();
			// h1 bleibt der Seitenüberschrift vorbehalten, daher ab h2.
			const level = Math.min(heading[1]!.length + 1, 5);
			blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
			continue;
		}

		const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
		if (unordered) {
			flushParagraph();
			if (listTag !== 'ul') flushList();
			listTag = 'ul';
			listItems.push(unordered[1]!);
			continue;
		}

		const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
		if (ordered) {
			flushParagraph();
			if (listTag !== 'ol') flushList();
			listTag = 'ol';
			listItems.push(ordered[1]!);
			continue;
		}

		flushList();
		paragraph.push(trimmed);
	}

	flushParagraph();
	flushList();

	return blocks.join('\n');
}
