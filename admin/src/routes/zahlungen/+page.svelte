<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { apiGet } from '$lib/api';
	import type { AdminOrder } from '$lib/types';

	let openOrders = $state<AdminOrder[]>([]);
	let loading = $state(true);

	async function load() {
		try {
			const [pending, confirming] = await Promise.all([
				apiGet<AdminOrder[]>('/admin/orders?status=pending'),
				apiGet<AdminOrder[]>('/admin/orders?status=confirming')
			]);
			openOrders = [...pending, ...confirming].sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
		} finally {
			loading = false;
		}
	}

	onMount(load);
	const timer = setInterval(load, 15000);
	onDestroy(() => clearInterval(timer));
</script>

<h1>Zahlungsmonitor</h1>
<p class="muted">Aktualisiert automatisch alle 15 Sekunden.</p>

{#if loading}
	<p class="muted">Lade…</p>
{:else if openOrders.length === 0}
	<p class="muted">Keine offenen Zahlungen.</p>
{:else}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Token</th>
					<th>Methode</th>
					<th>Betrag</th>
					<th>Adresse</th>
					<th>Status</th>
					<th>Bestätigungen</th>
					<th>Läuft ab</th>
				</tr>
			</thead>
			<tbody>
				{#each openOrders as order (order.id)}
					<tr>
						<td><code>{order.order_token.slice(0, 8)}…</code></td>
						<td>{order.payment_method}</td>
						<td>{order.amount_crypto} {order.payment_method}</td>
						<td class="address"><code>{order.payment_address}</code></td>
						<td><span class="badge status-{order.status}">{order.status}</span></td>
						<td>{order.confirmations}/{order.required_confirmations}</td>
						<td>{new Date(order.expires_at).toLocaleTimeString('de-DE')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.address code {
		word-break: break-all;
		white-space: normal;
	}
</style>
