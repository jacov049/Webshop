<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { auth } from '$lib/stores/auth.svelte';
	import LoginForm from '$lib/components/LoginForm.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { children } = $props();

	onMount(() => {
		auth.check();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CryptoShop Admin</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !auth.checked}
	<p class="container muted">Lade…</p>
{:else if !auth.authenticated}
	<LoginForm />
{:else}
	<Nav />
	<main class="container">
		{@render children()}
	</main>
{/if}
