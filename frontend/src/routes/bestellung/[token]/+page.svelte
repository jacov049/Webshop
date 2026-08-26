<script lang="ts">
	import { onDestroy } from 'svelte';
	import { apiGet } from '$lib/api';
	import QrCode from '$lib/components/QrCode.svelte';
	import type { OrderStatusResponse } from '$lib/types';

	let { data }: { data: { order: OrderStatusResponse; token: string } } = $props();

	let order = $state(data.order);
	let now = $state(Date.now());

	// Setzt den lokalen Status zurück, falls über einen Link zu einer
	// anderen Bestellung navigiert wird (Komponente wird wiederverwendet).
	$effect(() => {
		order = data.order;
	});

	const statusLabels: Record<string, string> = {
		pending: 'Warte auf Zahlung',
		confirming: 'Zahlung erkannt, warte auf Bestätigungen',
		paid: 'Bezahlt',
		expired: 'Zahlungsfenster abgelaufen',
		shipped: 'Versendet',
		cancelled: 'Storniert'
	};

	const paymentUri = $derived(
		order.payment_method === 'BTC'
			? `bitcoin:${order.payment_address}?amount=${order.amount_crypto}`
			: `monero:${order.payment_address}?tx_amount=${order.amount_crypto}`
	);

	const remainingSeconds = $derived(
		Math.max(0, Math.floor((new Date(order.expires_at).getTime() - now) / 1000))
	);
	const remainingLabel = $derived(
		`${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
	);

	const isOpen = $derived(order.status === 'pending' || order.status === 'confirming');

	const tickTimer = setInterval(() => (now = Date.now()), 1000);

	const pollTimer = setInterval(async () => {
		if (!isOpen) return;
		try {
			order = await apiGet<OrderStatusResponse>(`/api/orders/${data.token}`);
		} catch {
			// Netzwerkfehler: nächster Poll versucht es erneut
		}
	}, 5000);

	onDestroy(() => {
		clearInterval(tickTimer);
		clearInterval(pollTimer);
	});
</script>

<h1>Bestellung</h1>

<div class="stack">
	<p>
		<span class="badge status-{order.status}">{statusLabels[order.status] ?? order.status}</span>
	</p>

	{#if isOpen}
		<div class="card payment">
			<QrCode text={paymentUri} />
			<div class="stack">
				<p><strong>Zahlungsmethode:</strong> {order.payment_method}</p>
				<p><strong>Betrag:</strong> {order.amount_crypto} {order.payment_method}</p>
				<p class="address"><strong>Adresse:</strong> <code>{order.payment_address}</code></p>
				{#if remainingSeconds > 0}
					<p class="muted">Zahlungsfenster läuft ab in {remainingLabel} Min.</p>
				{:else}
					<p class="error-text">Zahlungsfenster abgelaufen. Bitte Kontakt aufnehmen.</p>
				{/if}
				<p class="muted">
					Bestätigungen: {order.confirmations} / {order.required_confirmations}
				</p>
			</div>
		</div>
	{:else if order.status === 'paid' || order.status === 'shipped'}
		<p>Vielen Dank! Deine Zahlung wurde erkannt.</p>
	{:else if order.status === 'expired'}
		<p>Das Zahlungsfenster ist abgelaufen. Bitte nimm über die Kontaktseite Verbindung auf.</p>
	{/if}

	<p class="muted">Diese Seite kannst du dir merken, um den Status jederzeit erneut abzurufen.</p>
</div>

<style>
	.payment {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.address code {
		word-break: break-all;
	}
</style>
