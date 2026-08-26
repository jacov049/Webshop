<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet } from '$lib/api';
	import OrderRow from '$lib/components/OrderRow.svelte';
	import type { AdminOrder, OrderStatus } from '$lib/types';

	let orders = $state<AdminOrder[]>([]);
	let loading = $state(true);
	let filter = $state<OrderStatus | ''>('');

	async function load() {
		loading = true;
		try {
			const query = filter ? `?status=${filter}` : '';
			orders = await apiGet<AdminOrder[]>(`/admin/orders${query}`);
		} finally {
			loading = false;
		}
	}

	onMount(load);
</script>

<h1>Bestellungen</h1>

<div class="row filter">
	<label>
		Status
		<select bind:value={filter} onchange={load}>
			<option value="">Alle</option>
			<option value="pending">pending</option>
			<option value="confirming">confirming</option>
			<option value="paid">paid</option>
			<option value="expired">expired</option>
			<option value="shipped">shipped</option>
			<option value="cancelled">cancelled</option>
		</select>
	</label>
</div>

{#if loading}
	<p class="muted">Lade…</p>
{:else if orders.length === 0}
	<p class="muted">Keine Bestellungen gefunden.</p>
{:else}
	<div class="stack">
		{#each orders as order (order.id)}
			<OrderRow {order} />
		{/each}
	</div>
{/if}

<style>
	.filter {
		margin-bottom: 1.25rem;
	}

	.filter label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.filter select {
		width: auto;
	}
</style>
