<script lang="ts">
	import type { Product } from '$lib/types';

	let { product }: { product: Product } = $props();
</script>

<a class="card product-card" href={`/produkt/${product.id}`}>
	{#if product.image_path}
		<img src={product.image_path} alt={product.name} loading="lazy" />
	{:else}
		<div class="placeholder"></div>
	{/if}
	<h3>{product.name}</h3>
	<p class="price">{Number(product.price_eur).toFixed(2)} €</p>
	{#if product.stock === 0}
		<p class="muted">Ausverkauft</p>
	{/if}
</a>

<style>
	.product-card {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	img,
	.placeholder {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: var(--radius);
		background: var(--color-bg);
		margin-bottom: 0.75rem;
	}

	h3 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}

	.price {
		margin: 0;
		font-weight: 600;
	}
</style>
