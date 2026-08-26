<script lang="ts">
	import Markdown from '$lib/components/Markdown.svelte';
	import type { SiteSettings } from '$lib/settings';

	// Inhalt wird im Admin-Panel unter "Einstellungen" gepflegt.
	let { data }: { data: { settings: SiteSettings } } = $props();
</script>

<svelte:head>
	<title>Widerrufsbelehrung – {data.settings.shop_name}</title>
</svelte:head>

<h1>Widerrufsbelehrung</h1>
<Markdown source={data.settings.widerruf_md} />
