<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte';
</script>

<h1>Warenkorb</h1>

{#if cart.items.length === 0}
	<p class="muted">Dein Warenkorb ist leer.</p>
	<a href="/">Zurück zu den Artikeln</a>
{:else}
	<div class="stack">
		{#each cart.items as item (item.productId)}
			<div class="card row">
				<div>
					<strong>{item.name}</strong>
					<p class="muted">{item.priceEur.toFixed(2)} € / Stk.</p>
				</div>
				<div class="row controls">
					<input
						type="number"
						min="1"
						value={item.quantity}
						oninput={(e) => cart.updateQuantity(item.productId, Number(e.currentTarget.value))}
					/>
					<button class="secondary" onclick={() => cart.remove(item.productId)}>Entfernen</button>
				</div>
			</div>
		{/each}

		<div class="card row total">
			<strong>Gesamt</strong>
			<strong>{cart.totalEur.toFixed(2)} €</strong>
		</div>

		<a href="/checkout"><button>Zur Kasse</button></a>
	</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.controls {
		max-width: 220px;
	}

	.controls input {
		width: 70px;
	}

	.total {
		font-size: 1.1rem;
	}
</style>
