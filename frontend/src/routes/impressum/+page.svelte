<script lang="ts">
	import Markdown from '$lib/components/Markdown.svelte';
	import type { SiteSettings } from '$lib/settings';

	// Inhalt wird im Admin-Panel unter "Einstellungen" gepflegt.
	let { data }: { data: { settings: SiteSettings } } = $props();
</script>

<svelte:head>
	<title>Impressum – {data.settings.shop_name}</title>
</svelte:head>

<h1>Impressum</h1>
<Markdown source={data.settings.impressum_md} />
