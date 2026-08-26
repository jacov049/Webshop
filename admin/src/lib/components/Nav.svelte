<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import KeyUnlock from './KeyUnlock.svelte';
</script>

<header class="admin-header">
	<div class="container row">
		<nav>
			<a href="/">Übersicht</a>
			<a href="/bestellungen">Bestellungen</a>
			<a href="/zahlungen">Zahlungsmonitor</a>
			<a href="/artikel">Artikel</a>
			<a href="/kontakt">Kontaktanfragen</a>
			<a href="/einstellungen">Einstellungen</a>
		</nav>
		<div class="row right">
			<KeyUnlock />
			<button class="secondary" onclick={() => auth.logout()}>Abmelden</button>
		</div>
	</div>
</header>

<style>
	.admin-header {
		border-bottom: 1px solid var(--color-border);
		padding: 1rem 0;
		margin-bottom: 2rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.right {
		margin-left: auto;
	}

	nav {
		display: flex;
		gap: 1.1rem;
	}

	nav a {
		text-decoration: none;
		color: var(--color-text-muted);
	}

	nav a:hover {
		color: var(--color-text);
	}
</style>
