<script lang="ts">
	let { note }: { note: string } = $props();
</script>

<footer class="site-footer">
	<div class="container row">
		<p class="muted">{note}</p>
		<nav>
			<a href="/impressum">Impressum</a>
			<a href="/datenschutz">Datenschutz</a>
			<a href="/widerruf">Widerruf</a>
		</nav>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--color-border);
		margin-top: 3rem;
		padding: 1.5rem 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	nav {
		display: flex;
		gap: 1rem;
	}

	nav a {
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 0.9rem;
	}

	nav a:hover {
		color: var(--color-text);
	}

	p {
		margin: 0;
		font-size: 0.9rem;
	}
</style>
