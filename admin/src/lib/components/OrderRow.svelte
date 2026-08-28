<script lang="ts">
	import { decryptPayload, keySession } from '$lib/decrypt/pgp.svelte';
	import { apiPatch } from '$lib/api';
	import type { AdminOrder, OrderPayload, OrderStatus } from '$lib/types';

	let { order }: { order: AdminOrder } = $props();

	let decrypted = $state<OrderPayload | null>(null);
	let decryptError = $state('');
	let decrypting = $state(false);
	let statusBusy = $state(false);

	const allowed: Record<OrderStatus, OrderStatus[]> = {
    pending: ['cancelled'], confirming: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'],
    expired: [], cancelled: [], shipped: []
  };
  const statuses = $derived([order.status, ...allowed[order.status]]);
  let statusError = $state('');
  // Clear plaintext on lock, including a decrypt promise that resolves after the lock.
  $effect(() => { if (!keySession.unlocked) decrypted = null; });

	async function decrypt() {
		decrypting = true;
		decryptError = '';
		try {
			const generation = keySession.generation;
      const result = await decryptPayload<OrderPayload>(order.encrypted_payload);
      if (keySession.unlocked && generation === keySession.generation) decrypted = result;
		} catch (err) {
			decryptError = err instanceof Error ? err.message : 'Entschlüsselung fehlgeschlagen.';
		} finally {
			decrypting = false;
		}
	}

	async function changeStatus(e: Event) {
		const status = (e.target as HTMLSelectElement).value as OrderStatus;
		statusBusy = true;
    statusError = "";
		try {
			await apiPatch(`/admin/orders/${order.id}/status`, { status });
			order.status = status;
		} catch (error) { statusError = error instanceof Error ? error.message : "Statuswechsel fehlgeschlagen"; (e.target as HTMLSelectElement).value = order.status; } finally {
			statusBusy = false;
		}
	}
</script>

<div class="card order-row">
	<div class="row header">
		<div>
			<code>{order.order_token.slice(0, 8)}…</code>
			<span class="muted">{new Date(order.created_at).toLocaleString('de-DE')}</span>
		</div>
		<span class="badge status-{order.status}">{order.status}</span>
	</div>

	<div class="row details">
		<span>{order.payment_method}</span>
		<span>{order.amount_crypto} {order.payment_method}</span>
		<span class="muted">({order.amount_eur} €)</span>
		<span class="muted">{order.confirmations}/{order.required_confirmations} Bestätigungen</span>
	</div>

	<div class="row controls">
		<select value={order.status} onchange={changeStatus} disabled={statusBusy}>
			{#each statuses as s (s)}
				<option value={s}>{s}</option>
			{/each}
		</select>
		{#if !decrypted}
			<button class="secondary" onclick={decrypt} disabled={decrypting || !keySession.unlocked}>
				{decrypting ? 'Entschlüssele…' : 'Entschlüsseln'}
			</button>
			{#if !keySession.unlocked}
				<span class="muted">PGP-Schlüssel oben entsperren</span>
			{/if}
		{/if}
	</div>

	{#if statusError}<p class="error-text">{statusError}</p>{/if}
	<h3>Verbindliche Bestellpositionen</h3>
	<ul>{#each order.items as item}<li>{item.quantity}× {item.name ?? "Altbestand: Artikelname nicht verifiziert"} ({item.unit_price_eur ?? "Preis unbekannt"} € / Stück)</li>{/each}</ul>
	{#if order.items.some(item => !item.name)}<p class="error-text">Altbestellung: Versandpositionen vor Versand manuell prüfen. Kundenangaben sind keine verifizierte Versandgrundlage.</p>{/if}
	{#if decryptError}
		<p class="error-text">{decryptError}</p>
	{/if}

	{#if decrypted}
		<div class="decrypted">
			<p><strong>{decrypted.name}</strong></p>
			<p>
				{decrypted.address.street}, {decrypted.address.zip} {decrypted.address.city}, {decrypted.address.country}
			</p>
			{#if decrypted.note}
				<p class="muted">Anmerkung: {decrypted.note}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.order-row {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header {
		justify-content: space-between;
	}

	.decrypted {
		border-top: 1px solid var(--color-border);
		padding-top: 0.6rem;
	}

	ul {
		margin: 0.3rem 0 0;
		padding-left: 1.1rem;
	}
</style>
