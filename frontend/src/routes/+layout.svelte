<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CryptoShop</title>
</svelte:head>

<Header />
<main class="container">
	{@render children()}
</main>
<Footer />

<style>
	main {
		min-height: 60vh;
		padding-top: 2rem;
		padding-bottom: 2rem;
	}
</style>
