<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet } from '$lib/api';
	import ContactRow from '$lib/components/ContactRow.svelte';
	import type { AdminContactRequest } from '$lib/types';

	let requests = $state<AdminContactRequest[]>([]);
	let loading = $state(true);

	async function load() {
		loading = true;
		try {
			requests = await apiGet<AdminContactRequest[]>('/admin/contact');
		} finally {
			loading = false;
		}
	}

	onMount(load);
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
