<script lang="ts">
	import Markdown from '$lib/components/Markdown.svelte';
	import type { SiteSettings } from '$lib/settings';

	// Inhalt wird im Admin-Panel unter "Einstellungen" gepflegt.
	let { data }: { data: { settings: SiteSettings } } = $props();
</script>

<svelte:head>
	<title>Datenschutzerklärung – {data.settings.shop_name}</title>
</svelte:head>

<h1>Datenschutzerklärung</h1>
<Markdown source={data.settings.datenschutz_md} />
