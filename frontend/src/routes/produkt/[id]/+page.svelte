<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte';
	import type { Product } from '$lib/types';

	let { data }: { data: { product: Product; rates: { btcPerEur: number; xmrPerEur: number } | null } } =
		$props();

	let quantity = $state(1);
	let added = $state(false);

	const priceEur = $derived(Number(data.product.price_eur));
	const priceBtc = $derived(data.rates ? priceEur * data.rates.btcPerEur : null);
	const priceXmr = $derived(data.rates ? priceEur * data.rates.xmrPerEur : null);

	function addToCart() {
		cart.add(
			{ productId: data.product.id, name: data.product.name, priceEur },
			quantity
		);
		added = true;
		setTimeout(() => (added = false), 2000);
	}
</script>

<div class="detail">
	{#if data.product.image_path}
		<img src={data.product.image_path} alt={data.product.name} />
	{/if}
	<div class="stack">
		<h1>{data.product.name}</h1>
		<p class="price">{priceEur.toFixed(2)} €</p>
		{#if priceBtc !== null && priceXmr !== null}
			<p class="muted">
				≈ {priceBtc.toFixed(8)} BTC &nbsp;·&nbsp; ≈ {priceXmr.toFixed(4)} XMR
			</p>
		{/if}
		{#if data.product.description}
			<p>{data.product.description}</p>
		{/if}

		{#if data.product.stock > 0}
			<div class="row">
				<input type="number" min="1" max={data.product.stock} bind:value={quantity} />
				<button onclick={addToCart}>In den Warenkorb</button>
			</div>
			{#if added}
				<p class="muted">Zum Warenkorb hinzugefügt.</p>
			{/if}
		{:else}
			<p class="error-text">Ausverkauft</p>
		{/if}
	</div>
</div>

<style>
	.detail {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	img {
		width: 100%;
		border-radius: var(--radius);
	}

	.price {
		font-size: 1.4rem;
		font-weight: 600;
		margin: 0;
	}

	.row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		max-width: 260px;
	}

	@media (max-width: 720px) {
		.detail {
			grid-template-columns: 1fr;
		}
	}
</style>
