<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet } from '$lib/api';
	import ContactRow from '$lib/components/ContactRow.svelte';
	import type { Page, AdminContactRequest } from '$lib/types';

	let requests = $state<AdminContactRequest[]>([]);
	let loading = $state(true);

	let nextCursor = $state<string | null>(null);
  let loadError = $state('');
  async function load(more = false) {
    loadError = "";
		loading = true;
		try {
			const page = await apiGet<Page<AdminContactRequest>>(`/admin/contact?${more && nextCursor ? 'cursor='+encodeURIComponent(nextCursor) : ''}`);
      requests = more ? [...requests, ...page.items] : page.items;
      nextCursor = page.nextCursor;
		} catch (error) { loadError = error instanceof Error ? error.message : "Laden fehlgeschlagen"; } finally {
			loading = false;
		}
	}

	onMount(() => { void load(); });
</script>

<h1>Kontaktanfragen</h1>

{#if loading}
	<p class="muted">Lade…</p>
{:else if requests.length === 0}
	<p class="muted">Keine Kontaktanfragen.</p>
{:else}
	<div class="stack">
		{#each requests as request (request.id)}
			<ContactRow {request} />
		{/each}
	</div>
{/if}

{#if loadError}<p class="error-text">{loadError}</p>{/if}
{#if nextCursor}<button onclick={() => load(true)} disabled={loading}>Weitere laden</button>{/if}
