<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import type { Product } from '$lib/types';

	let { data }: { data: { products: Product[] } } = $props();
</script>

<h1>Artikel</h1>

{#if data.products.length === 0}
	<p class="muted">Derzeit keine Artikel verfügbar.</p>
{:else}
	<div class="grid">
		{#each data.products as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
{/if}
