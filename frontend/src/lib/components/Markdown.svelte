<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	let { source }: { source: string } = $props();

	// renderMarkdown escaped den Eingabetext vollständig, bevor die
	// erlaubten Markdown-Konstrukte eingesetzt werden – siehe
	// src/lib/markdown.ts. Deshalb ist {@html} hier unbedenklich.
	const html = $derived(renderMarkdown(source));
</script>

<div class="prose">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	.prose :global(h2) {
		font-size: 1.15rem;
		margin: 1.6rem 0 0.5rem;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		font-size: 1rem;
		margin: 1.2rem 0 0.4rem;
	}

	.prose :global(p) {
		margin: 0 0 0.85rem;
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 0.85rem;
		padding-left: 1.3rem;
	}

	.prose :global(li) {
		margin-bottom: 0.3rem;
	}

	.prose :global(code) {
		background: var(--color-bg);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-size: 0.9em;
	}

	.prose :global(h2:first-child),
	.prose :global(h3:first-child) {
		margin-top: 0;
	}
</style>
