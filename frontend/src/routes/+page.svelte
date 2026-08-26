<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import type { Product } from '$lib/types';
	import type { SiteSettings } from '$lib/settings';

	let {
		data
	}: { data: { products: Product[]; loadError: boolean; settings: SiteSettings } } = $props();
</script>

<h1>{data.settings.catalog_heading}</h1>

{#if data.settings.catalog_intro_md}
	<Markdown source={data.settings.catalog_intro_md} />
{/if}

{#if data.loadError}
	<p class="error-text">
		Die Artikel konnten gerade nicht geladen werden. Bitte versuche es später erneut.
	</p>
{:else if data.products.length === 0}
	<p class="muted">Derzeit keine Artikel verfügbar.</p>
{:else}
	<div class="grid">
		{#each data.products as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
{/if}
