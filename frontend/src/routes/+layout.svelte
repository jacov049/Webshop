<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import type { SiteSettings } from '$lib/settings';

	let { children, data }: { children: import('svelte').Snippet; data: { settings: SiteSettings } } =
		$props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.settings.shop_name}</title>
	<meta name="description" content={data.settings.shop_description} />
</svelte:head>

<Header shopName={data.settings.shop_name} />
<main class="container">
	{@render children()}
</main>
<Footer note={data.settings.footer_note} />

<style>
	main {
		min-height: 60vh;
		padding-top: 2rem;
		padding-bottom: 2rem;
	}
</style>
