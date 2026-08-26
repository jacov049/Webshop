<script lang="ts">
	import { cart } from '$lib/stores/cart.svelte';
</script>

<header class="site-header">
	<div class="container row">
		<a class="brand" href="/">CryptoShop</a>
		<nav>
			<a href="/">Artikel</a>
			<a href="/kontakt">Kontakt</a>
			<a href="/warenkorb" class="cart-link">
				Warenkorb
				{#if cart.totalItems > 0}
					<span class="cart-count">{cart.totalItems}</span>
				{/if}
			</a>
		</nav>
	</div>
</header>

<style>
	.site-header {
		border-bottom: 1px solid var(--color-border);
		padding: 1rem 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand {
		font-weight: 700;
		font-size: 1.15rem;
		text-decoration: none;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}

	nav {
		display: flex;
		gap: 1.25rem;
		align-items: center;
	}

	nav a {
		text-decoration: none;
		color: var(--color-text-muted);
	}

	nav a:hover {
		color: var(--color-text);
	}

	.cart-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.cart-count {
		background: var(--color-accent);
		color: #fff;
		border-radius: 999px;
		font-size: 0.75rem;
		padding: 0.05rem 0.45rem;
	}
</style>
